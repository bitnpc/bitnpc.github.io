---
layout: post
title: "iOS中的Crash探究"
date: 2018-11-28
categories:: iOS
tags: 
    - Crash
    - iOS
    - 异常处理
---  

Crash 是我们在日常使用 App 时，偶尔会遇到的“闪退”。闪退会带来糟糕的用户体验，影响 App 的正常使用。   
App 的 Crash 率是衡量该App质量的标准之一。美团 App 的 Crash 率一般控制在万分之五以下。   
下面，我主要谈谈 iOS 中 App 的 Crash，并结合实际开发工作，给出一些排查建议。    


# Crash是什么？

Crash 本质是一种异常控制。   

现代操作系统需要有一整套完善的处理流程来解决异常。这种流程叫做 Exception Control Flow（ECF）。异常控制可以发生在硬件层，软件层和应用层。  
在硬件层，硬件检测到的事件，会触发控制突然转移到异常处理程序。  
在操作系统层，内核通过上下文转换将控制从一个用户进程转移到另一个用户进程。  
在应用层，一个进程可以发送信号到另一个进程。如在终端执行 kill 命令，杀死其他进程。  

一般而言，App 的 Crash 和硬件没有直接关系，所以我们主要来看操作系统和应用层的异常处理。  

## 操作系统的异常控制

操作系统的异常分为4种。中断（interrupt），陷阱（trap），故障（fault）和终止（abort）。  
注: 该分类源于《深入理解计算机系统 》第8章，作者 Randal E Bryant, David R. O'Hallaron。  
有些观点认为中断不属于异常。我的理解是该书中的异常是广义上的异常，是进程没有按照原先的逻辑来执行的所有异常情况，从这个角度来看，它包括了中断。

|     类别     |           原因       |   异步/同步   |        返回行为       |
|-------------|----------------------|-------------|----------------------|
|     中断     |    来自I/O设备的信号   |     异步     |  总是返回到下一个指令   |
|     陷阱     |       有意的异常      |     同步     |  总是返回到下一个指令   |
|     故障     |    潜在可恢复的错误    |     同步     |    可能返回到当前指令   |
|     终止     |     不可恢复的错误     |     同步     |       不会返回        |

中断（interrupt）是唯一一个异步发生的异常。由硬件产生，通过中断控制器发送给 CPU，CPU 判断中断来源后发送到操作系统内核，最后到达用户进程。举个例子。当我们把 iPhone 由竖屏旋转至横屏时，iPhone 中的陀螺仪会产生一系列中断，经过中断处理程序和操作系统内核的处理，最终使得App接收到横屏的 notification，并作出响应。   
陷阱（trap）是有意的异常，主要作用是提供系统调用。如打开文件。  
故障（fault）是由错误引起。可能会被故障处理程序修复，如缺页异常。  
终止（abort）是不可恢复的致命错误。通常是由硬件产生。  

通常情况下，在操作系统层，fault 是导致App Crash的主要因素。  
比如常见的 SegmentFault 是一种 fault，它是指段错误，访问了错误的内存地址。一般而言不可被故障处理程序修复，会直接导致进程退出。  

## 应用层的异常控制

不同的应用软件，有不同的异常控制。Java 的 JVM 和 iOS 的 runtime 是两套运行时环境，他们的异常控制机制有所不同。  
在Java中，所有的异常都有一个共同的祖先Throwable。Throwable有两个子类，Error和Exception。
- Error，是程序无法处理的错误，意味着代码运行时JVM出现了问题。如Virtual Machine Error，和Out Of Memory Error。
- Exception，是程序本身可以处理的异常。如Null Pointer Exception、Arithmetic Exception。
安卓App的大部分Crash会在JVM这一层检测并得到处理。

iOS App 的运行基于 runtime 环境。它也提供了一些异常控制，防止异常传递到操作系统层。如Unrecognized selector sent to instance就属于runtime的保护措施。  


# Crash的原因

App发生Crash的原因可能有很多种。  

## CPU无法执行代码

- 非法算术运算。
除0计算。  

- 无效的指令。
如基于x86_64架构的CPU（CISC指令集），无法运行在基于ARM架构的CPU（RISC指令集）。也可能是其他无效指令，如把数据当成指令的情况。  

- 无效的内存地址。应用程序在内存中的内存布局如下图所示。  
![Desktop View](/assets/img/post/post-2018-11-30/memory_layout.png){: width="972" height="589" .w-50 .normal}

由低地址到高地址依次为：  代码段（.text）  已初始化的数据（.data）  未初始化的数据（.bss）  堆（heap）  栈（stack）  
当进程在执行时，会在栈中创建保存指针的变量pointer，pointer指向堆中对象的内存地址。如果堆中对象的内存地址被释放，但是pointer未置空，那么随着进程不断执行，后续会向这块堆中的内存写数据，如果继续访问该pointer，则很可能会导致Crash。这种pointer被称为野指针。通常情况下，多线程操作是导致这种情况出现的主要因素。  

## 操作系统出于某种因素

- WatchDog事件。
用来检测应用是否长时间无响应，模拟器无此功能。

- 机器过热  
可能是由于CPU负载太高。操作系统会优先kill掉CPU占有率过高的App.

- 内存不足   
App在运行期间可能会收到memoryWarning。在这个方法里面应该做一些释放内存的操作。  

- 签名无效  
比如企业证书到期，App启动时就会直接退出。   

## 编程语言的保护措施

- 找不到指定方法。Runtime提供的保护措施。

- 数组越界。  

不是所有语言都提供这种保护措施。如C语言就不提供数组越界的保护。  

如下代码，第三行，在C语言中是不会Crash的，但是第四行打印出来的内容是未知的。 在第七行是Objective-C代码，同样是数组越界，它就必然会发生Crash。

```
int main () {
    char str[6] = {'b','i','t','n','p','c'};
    char c = str[6];                    // 不会Crash
    printf("%c\n", c);                  // 打印出的字符未知

    NSArray *array = @[@"b", @"i", @"t", @"n", @"p", @"c"];
    id obj = array[6];                  // Crash
    NSLog(@"%@\n", obj);
}
```

## 开发者的防范措施

这里主要是指用Assert来检查某些重要的参数。


# Crash传递的流程与捕获方式

当App发生Crash时，是有一定的传递流程的。这里以iOS App的Crash为例。   
在操作系统层其传递顺序为Mach内核->Unix。在应用层，则会产生一个NSException。  
所以捕获的时候，就可以分别在对应的层次捕获堆栈信息。   
苹果为了统一机制，操作系统和用户操作都会产生Mach异常。所以所有Crash都有对应Mach异常的exception_type。  
最后，把捕获到的CrashLog符号化，转化为可读的堆栈信息。  

## Mach异常 

Mach异常是最底层的内核级异常，如EXC_BAD_ACCESS。在异常发生时，会被异常处理程序转换为Mach消息，接着依次投递到thread，task和host端口。

通过监听这些端口，来捕获Mach层的异常。这里以PLCrashReporter为例（此处仅列出关键代码）。具体代码可查看[PLCrashMachExceptionServer](https://github.com/plausiblelabs/plcrashreporter/blob/master/Source/PLCrashMachExceptionServer.m)  

```
// Initialize the bare context. 
// Initalize our server's port
mach_port_allocate(mach_task_self(), MACH_PORT_RIGHT_RECEIVE, &_serverContext->server_port);

// Initialize our notification port
mach_port_allocate(mach_task_self(), MACH_PORT_RIGHT_RECEIVE, &_serverContext->notify_port);
mach_port_insert_right(mach_task_self(), _serverContext->notify_port, _serverContext->notify_port, MACH_MSG_TYPE_MAKE_SEND);

// Initialize our port set.
mach_port_allocate(mach_task_self(), MACH_PORT_RIGHT_PORT_SET, &_serverContext->port_set);

// Add the service port to the port set
mach_port_move_member(mach_task_self(), _serverContext->server_port, _serverContext->port_set);

// Add the notify port to the port set
mach_port_move_member(mach_task_self(), _serverContext->notify_port, _serverContext->port_set);

// Spawn the server thread.
pthread_create(&thr, &attr, &exception_server_thread, _serverContext)
```

Mach异常即使注册了对应的处理，也不会影响原先的传递流程。Mach异常会继续传递到Unix层，转变为Unix Signal。但是如果Mach异常让进程退出，则对应的Unix信号则不会产生。  

一个Mach异常对应一个或多个Unix Signal。  

### 常见的exception_types

|   Exception类型    |       描述       |           说明            |
|-------------------|-----------------|---------------------------|
|  EXC_BAD_ACCESS   |Bad Memory Access|错误内存地址，访问的地址不存在或者当前进程没有权限都会报这个错。|
|     EXC_CRASH     |  Abnormal Exit  |通常跟随的UNIX Signal是SIGABRT，当前进程被系统检测到有异常行为而杀死|
|EXC_BAD_INSTRUCTION|Illegal Instruction|非法或未定义的指令或操作数|

## Unix Signal
Unix Signal是Unix系统的一种异步通知机制。Mach异常在host层被ux_exception转换为相应的Unix Signal，并通过threadsignal将信号投递到出错的线程。如SIGABRT，SIGSEGV。

在Unix层则可以注册Signal处理回调。如下代码是把接受到的SIGBUS统一用signalHander来处理。

```
void signalHander(int sig){
    printf("signal %d received.\n", sig);
    exit();
}

int main () {
    signal(SIGBUS, sigHanler);
    char *str = "bitnpc";
    str[0] = 'H';
}
```

### 常见的Unix信号 
下表列出了常见的Unix Signal。在macOS系统中，可以输入"man signal"查看所有的Signal列表。在[这里](https://github.com/torvalds/linux/blob/master/include/linux/signal.h)也可以看到。    

|  Unix Signal  |                  说明                   |
|---------------|----------------------------------------|
|    SIGSEGV    |访问了无效的内存地址，这个地址存在，但是当前进程没有权限访问它。属于硬件层错误|
|    SIGABRT    |程序Crash，这个符号是由C函数abort()触发的。通常代表系统发现当前程序执行出错。属于软件层错误|
|    SIGBUS     |访问了无效的内存地址，与SIGSEGV的区别是：SIGBUS表示内存地址不存在。属于硬件层错误|
|    SIGTRAP    |Debugger相关|
|    SIGILL     |尝试执行一个非法的、未知的、没有权限的指令|

## NSException

发生在iOS系统库。如CoreFoundation，Runtime等等。可以通过NSSetUncaughtExceptionHandler来注册NSException的捕获函数。  
如下代码，会在exceptionHandler函数中获取exception的一些信息。

```
void exceptionHandler(NSException *exception)
{
    NSString *name = [exception name];                          // 异常名称
    NSString *reason = [exception reason];                      // 出现异常的原因
    NSArray *stackArray = [exception callStackSymbols];         // 异常的堆栈信息
    NSLog(@"%@_%@", name, reason);
    NSLog(@"%@", stackArray);
}

int main() {
    NSSetUncaughtExceptionHandler(&exceptionHandler);
    NSArray *array = @[@"b", @"i", @"t", @"n", @"p", @"c"];
    id obj = array[6];
}
```

## CrashLog符号化
Crash捕获后获得的数据都是对应的虚拟内存地址。我们需要把虚拟内存地址转化为可读的堆栈信息。   
符号化的本质是在一个映射文件中，找到内存地址对应的函数的方法名。    
主要有以下三种符号化方法。 
- 使用Xcode来符号化 
- Symbolicatecrash
- mac下的atos工具和Linux平台的替代品atosl

项目代码的符号文件在dSYM中。系统库的符号文件，可以从iOS固件中获取，也可以从Github上开源项目中找到对应系统的符号文件。  


# Crash排查思路
通常情况下，debug时发生的Crash很好解决。但是，App上线后，往往会出现一些本地没有遇到过，并且难以复现的Crash。并且从CrashLog中往往不能直接定位问题所在。

## 定位
- 搜集线索   
    CrashLog。系统版本，App版本（分析改动日志），线程堆栈。
    用户操作日志。有些App中集成进了记录用户操作行为的功能，如美团的Logan。可以通过操作日志复现用户操作路径。
    使用搜索引擎。查询是否有人遇到过类似的问题，Stackoverflow可能会帮到你。

- 尝试复现   
    通过上面搜集到的线索，可以大概确定Crash发生的范围，从而帮助我们复现问题。有些野指针问题，在本地难以复现。可尝试后使用一些工具，提高野指针的崩溃率。比如Xcode的Diagnostics中提供的Malloc Scribble，Zombie Object等工具。  

### Malloc Scribble

原理是通过在已释放对象中填充0x55，使得野指针调用必然崩溃。仅本地debug时有效，如果想在内测包中实现此功能，需要hook系统库中的free函数。以如下代码为例（为便于说明，已关闭ARC）:

```
UIView *view = [UIView new];
[view release];
[view setNeedsLayout];
```

很显然，此时view指向的对象已释放，但是view指针未置为nil。所以我们在向一个已释放的对象发送了消息。但是，编译运行后，发现并不会Crash。  

打开Malloc Scribble后，可以从调试面板很清晰的看到，在第三行发生了Crash。  

### Zombie Object

把已释放的对象标记为僵尸对象，Xcode的实现方式是使用runtime方法object_setClass，复写被释放的view的isa为_NSZombie_UIView。
除了上述Memory Management的工具，Xcode还提供了Runtime Sanitization的工具（实际上是LLVM编译器提供的功能）。如可以监测竞态访问的Thread Sanitizer，可以帮助开发者发现潜在的问题。

## 案例分析

下面是一个CrashLog，为了便于阅读，省略了不相关的部分。

```
Incident Identifier: 61590478-FA94-496E-9208-D2016678D6D0
CrashReporter Key:   TODO
Hardware Model:      iPhone7,2
Process:         imeituan [10672]
Path:            /var/containers/Bundle/Application/2140260F-0484-4CED-AC09-DEC9B620A63A/imeituan.app/imeituan
Identifier:      com.meituan.imeituan
Version:         9.1.0 (3123)
Code Type:       ARM-64
Parent Process:  ??? [1]

Date/Time:       2018-11-12 08:44:34 +0000
OS Version:      iPhone OS 10.1.1 (14B100)
Report Version:  104

Exception Type:  SIGSEGV
Exception Codes: SEGV_ACCERR at 0x20
Crashed Thread:  22

Thread 22 Crashed:
0   libobjc.A.dylib                     objc_registerClassPair + 32
1   Foundation                          _NSKVONotifyingCreateInfoWithOriginalClass + 136
2   Foundation                          _NSKeyValueContainerClassGetNotifyingInfo + 80
3   Foundation                          -[NSKeyValueUnnestedProperty _isaForAutonotifying] + 84
4   Foundation                          -[NSKeyValueUnnestedProperty isaForAutonotifying] + 100
5   Foundation                          -[NSObject(NSKeyValueObserverRegistration) _addObserver:forProperty:options:context:] + 436
6   Foundation                          -[NSObject(NSKeyValueObserverRegistration) addObserver:forKeyPath:options:context:] + 124
7   imeituan                            -[NSObject(RACSelectorSignal) racSignal_addObserver:forKeyPath:options:context:] (NSObject+RACSelectorSignal.m:63)
8   imeituan                            -[RACKVOTrampoline initWithTarget:observer:keyPath:options:block:] (RACKVOTrampoline.m:50)
9   imeituan                            -[NSObject(RACKVOWrapper) rac_observeKeyPath:options:observer:block:] (NSObject+RACKVOWrapper.m:115)
10  imeituan                            __84-[NSObject(RACPropertySubscribing) rac_valuesAndChangesForKeyPath:options:observer:]_block_invoke.41 (NSObject+RACPropertySubscribing.m:0)
......
49  imeituan                            -[TPKxxxItem initWithText:jumpUrlString:] (TPKPOIDetailLookMoreCell.m:60)
50  imeituan                            -[TPKxxxViewModel itemsWithModel:] (TPKxxxViewModel.m:102)
51  imeituan                            __51-[TPKxxxViewModel setupViewModel]_block_invoke (TPKxxxViewModel.m:43)
......
```

首先，来搜索一下堆栈信息。这里可供搜索的堆栈在0-6行。比如我们搜索objc_registerClassPair，它是runtime创建类时调用的一个方法。但是这个信息不足以定位问题。  

由堆栈第四行，搜索到了一片KVO创建同名类导致Crash的文章。但是，本项目是组件化的，每个pod都有不同的前缀，不存在不同二进制包中有多个符号并存的问题。  

接下来，就看看能否复现。找到TPKxxxViewModel所对应的页面，发现没有发生Crash。考虑到Crash的线程是后台线程，猜测很有可能是多线程创建TPKxxxItem导致的问题。那就可以写一些测试代码来尝试复现。注意，注意该段代码执行的时机要和实际创建该item一致。

```
for (int i = 0; i < 5; i++) {
    dispatch_async(dispatch_get_global_queue(DISPATCH_PRIORITY_DEFAULT, 0), ^{
        TPKxxxItem *item = [[TPKxxxItem alloc] initWithText:@"bit" jumpUrlString:@"npc"];
    });
}
```

很幸运，成功复现。Crash位置是项目中的一个基础库。查看该基础库的改动日志，发现多了一些swizzle的操作。该类有一个步骤类似于KVO的机制，过程中会创建一个新类。  
但是，后续又有KVO该类的操作。所以，我们的问题就转化KVO在创建同名类的子类就会Crash的问题，正好契合前面搜集的资料。  
那么，为什么KVO在创建同名类的子类时会Crash呢？我们知道，KVO主要做了以下几件事:  

1. 使用objc_registerClassPair方法，动态创建一个新类：NSKVONotifying_xxx
2. 把新类设置为原先的类的子类，并将原先的类的isa指针指向新类。
3. 把新类添加进入全局的类表里
4. 重写新类的set方法

在步骤一，如果创建两个同名的新类，会如何？可以写个测试代码验证一下。

```
- (void)applicationDidFinishLaunching:(NSNotification *)aNotification {
    Class testClass1 = objc_allocateClassPair([NSObject class], "bitnpc_crash_test", 0);
    objc_registerClassPair(testClass1);

    Class testClass2 = objc_allocateClassPair([NSObject class], "bitnpc_crash_test", 0);
    objc_registerClassPair(testClass2);         # EXC_BAD_ACCESS
}
```

objc_allocateClassPair时，返回的class为nil。接着，用objc_registerClassPair注册新类时，由于传入的参数为nil，导致了crash。  
再查看objc-runtime源码（objc4-723版本），可以看出，如果getClass(name)返回的类不为空，则直接返回nil，不分配新的内存空间。

```
/***********************************************************************
* objc_allocateClassPair
* fixme
* Locking: acquires runtimeLock
**********************************************************************/
Class objc_allocateClassPair(Class superclass, const char *name, 
                             size_t extraBytes)
{
    Class cls, meta;

    rwlock_writer_t lock(runtimeLock);

    // Fail if the class name is in use.
    // Fail if the superclass isn't kosher.
    if (getClass(name)  ||  !verifySuperclass(superclass, true/*rootOK*/)) {
        return nil;
    }

    // Allocate new classes.
    cls  = alloc_class_for_subclass(superclass, extraBytes);
    meta = alloc_class_for_subclass(superclass, extraBytes);

    // fixme mangle the name if it looks swift-y?
    objc_initializeClassPair_internal(superclass, name, cls, meta);

    return cls;
}
```

到这里，原因已经很清晰了。可以用以下流程图来表示。  
![Desktop View](/assets/img/post/post-2018-11-30/case_crash_flow.png){: width="972" height="589" .w-75 .normal}

项目中某基础库创建了两个TPKxxxItem_XXX，我们暂且称之为中间类。   
KVO用这两个中间类创建子类时，因为没有分配到内存空间，导致objc_registerClassPair时，发生了crash。    
解决方案则是在创建中间类时，对self.class加锁，保证只生成一个中间类。

注: 生成TPKxxxItem_XXX没有Crash的原因是，多线程创建同名类时，objc_allocateClassPari不一定返回null，这和底层容器的实现有关。  

该框架内部做了判断，当objc_allocateClassPari返回null时，不执行register操作。但是KVO显然没有做这样的判断。  


# 总结

本文结合了操作系统的异常控制，讨论了Crash的本质，成因，传递流程，说明了Crash的堆栈捕获层次与符号化方式，简要说明了Crash的排查思路，并给出了一个案例分析。  

除了上述流程，在Crash的预防、Crash的监控止损甚至是Crash的自我修复等流程上也可以做出一些措施，来降低App的Crash率，提高App整体质量。
