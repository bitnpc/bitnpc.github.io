---
layout: post
title: "模型对象归档"
date: 2017-02-27
categories:: iOS
---

# 概念
持久化：把内存中的部分数据保存到磁盘里，以便在App退出后重新打开时，可以继续访问该部分数据。保存的位置，当然就是在App的沙盒中。

## iOS 沙盒
iOS 安全模型的精髓在于沙盒（SandBox）。我们在从AppStore中下载安装App后，系统会在文件系统中创建一个该App的主目录，并且只对该App可读。这样导致不同App之间共享信息比较困难。好处是可以App之间互不干扰，系统稳定。
我们知道，Unix是多用户的系统。在安卓系统中，每个程序都有一个User ID。但是在iOS中，所有App都以统一的User ID（501，Mobile）运行。
在沙盒中有4个顶级目录：
+ .app bundle   是由Xcode最终构建出来并复制到设备上的包。存放应用程序的源文件，包括资源文件和可执行文件。所有内容经过数字签名，无法修改。
```objc
NSString *path = [[NSBundle mainBundle] bundlePath];
```
+ Documents     存放用户可见数据。iCloud会自动备份此目录的数据。
```objc
NSString *path = NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES).firstObject;
```
+ Library       存储不能被用户直接看到的文件。大部分文件应该放在Library/Application Support目录下。该目录会自动备份。
                Library/Caches不会被备份。会在升级过程中保留。
```objc
NSString *path = NSSearchPathForDirectoriesInDomains(NSCachesDirectory, NSUserDomainMask, YES).firstObject;
```
+ temp         不会被备份。升级后不保留。
```objc
NSString *path = NSTemporaryDirectory();
```

### 常用的数据持久化方法
1. Plist(包含NSUserDefaults)
2. 归档(NSKeyedArchiver)
3. SQLite
4. Core Data

其中，plist就是Property List的缩写。它有两种格式，一种是XML，方便阅读和编辑，NSUserDefaults保存的就是这种，优点是速度快，保存简单的数据很方便。缺点是过分依赖Key，转换成Object Graph比较麻烦。另一种是二进制的，归档保存的文件就是这种。优点是节约存储空间，可以创建自己想要的数据模型，然后统一以模型方式存储。
另两种方法在这里暂不讨论。

### 归档示例

{% highlight objc linenos %}
@interface TreeNode : NSObject

@property (nonatomic, assign) NSInteger value;
@property (nonatomic, weak) TreeNode *parentNode;
@property (nonatomic, strong) NSMutableArray *childNodes;

@end


@implementation TreeNode

- (instancetype)initWithCoder:(NSCoder *)aDecoder
{
    self = [super init];
    self.value = [aDecoder decodeIntegerForKey:@"value"];
    self.parentNode = [aDecoder decodeObjectOfClass:[self class] forKey:@"parentNode"];
    self.childNodes = [aDecoder decodeObjectForKey:@"childNodes"];
    return self;
}

- (void)encodeWithCoder:(NSCoder *)encoder
{
    [encoder encodeInteger:self.value forKey:@"value"];
    [encoder encodeObject:self.parentNode forKey:@"parentNode"];
    [encoder encodeObject:self.childNodes forKey:@"childNodes"];
}

@end
{% endhighlight %}

{% highlight objc linenos %}
@interface ViewController : UIViewController

@property (nonatomic, strong) TreeNode *root;

@end

@implementation ViewController

- (void)viewDidLoad
{
    [super viewDidLoad];

    TreeNode *root = [TreeNode new];
    root.value = 1;
    
    TreeNode *leftNode = [TreeNode new];
    leftNode.value = 2;
    leftNode.parentNode = root;
    
    TreeNode *rightNode = [TreeNode new];
    rightNode.value = 3;
    rightNode.parentNode = root;
    
    root.childNodes = [NSMutableArray arrayWithArray:@[leftNode, rightNode]];
    self.root = root;

    [[NSNotificationCenter defaultCenter] addObserver:self selector:@selector(resignActive) name:UIApplicationWillResignActiveNotification object:nil];
    [[NSNotificationCenter defaultCenter] addObserver:self selector:@selector(becomeActive) name:UIApplicationWillEnterForegroundNotification object:nil];
}

- (void)resignActive
{
    // 获取temp目录
    NSString *homeDictionary = NSTemporaryDirectory();
    // 添加储存的文件名
    NSString *homePath  = [homeDictionary stringByAppendingPathComponent:@"tc.archiver"];
    BOOL result = [NSKeyedArchiver archiveRootObject:_root toFile:homePath];
    NSLog(@"%d", result);
}

- (void)becomeActive
{
    NSString *homeDictionary = NSTemporaryDirectory();
    NSString *homePath  = [homeDictionary stringByAppendingPathComponent:@"tc.archiver"];
    NSArray *obj = [NSKeyedUnarchiver unarchiveObjectWithFile:homePath];
    NSLog(@"%@", obj);
}

@end
{% endhighlight %}