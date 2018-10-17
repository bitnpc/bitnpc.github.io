---
layout: post
title: "响应链（Responder Chain）"
date: 2017-02-28
categories:: iOS
---

### 事件（UIEvent）
![image](https://developer.apple.com/library/content/documentation/EventHandling/Conceptual/EventHandlingiPhoneOS/Art/events_to_app_2x.png)

iOS中事件分为3大类：触摸事件（Multitouch events），加速器事件（Accelerometer events），远程控制事件（Remote Control events）。

开发中最常见的事件就是触摸事件。下面我们就以触摸事件为例，说明我们的手指是如何与App交互的。

### 响应者（UIResponder）
能够处理UIEvent的NSObject被称为响应者，通常情况下，响应者直接或间接继承自UIResponder，比如UIView（CALayer不可以），UIButton。也有例外，比如UIBarButtonItem。若干个响应者组成一个链式的结构，这就是响应链。

UIResponder内部提供处理事件的方法有 :
{%highlight objc linenos%}
// 触摸事件
- (void)touchesBegan:(NSSet *)touches withEvent:(UIEvent *)event;
- (void)touchesMoved:(NSSet *)touches withEvent:(UIEvent *)event;
- (void)touchesEnded:(NSSet *)touches withEvent:(UIEvent *)event;
- (void)touchesCancelled:(NSSet *)touches withEvent:(UIEvent *)event;
// 加速计事件
- (void)motionBegan:(UIEventSubtype)motion withEvent:(UIEvent *)event;
- (void)motionEnded:(UIEventSubtype)motion withEvent:(UIEvent *)event;
- (void)motionCancelled:(UIEventSubtype)motion withEvent:(UIEvent *)event;
// 远程控制事件
- (void)remoteControlReceivedWithEvent:(UIEvent *)event;
{%endhighlight%}

除了以上方法，还有一个抽象类：UIGestureRecognizer，它可以识别UIView上的各种手势操作。
CocoaTouch提供了以下几种手势：
{%highlight objc linenos%}
UITapGestureRecognizer(敲击)
UIPinchGestureRecognizer(捏合，用于缩放)
UIPanGestureRecognizer(拖拽)
UISwipeGestureRecognizer(轻扫)
UIRotationGestureRecognizer(旋转)
UILongPressGestureRecognizer(长按)
{%endhighlight%}
我们也可以自己写一个继承自UIGestureRecognizer的类，自定义我们需要的手势操作。

### UITouch
当我们用手指触摸屏幕时，iOS会创建一个对应的UITouch对象。它主要有以下几种属性 ：
{%highlight objc linenos%}
// 触摸产生时所处的窗口
@property(nonatomic,readonly,retain) UIWindow *window;
// 触摸产生时所处的视图
@property(nonatomic,readonly,retain) UIView   *view;
// 短时间内点按屏幕的次数，可以根据tapCount判断单击、双击或更多的点击
@property(nonatomic,readonly) NSUInteger      tapCount;
// 记录了触摸事件产生或变化时的时间，单位是秒
@property(nonatomic,readonly) NSTimeInterval  timestamp;
// 当前触摸事件所处的状态
@property(nonatomic,readonly) UITouchPhase    phase;
{%endhighlight%}
还有以下两种方法：
{%highlight objc linenos%}
/*
  返回值表示触摸在view上的位置
  这里返回的位置是针对传入的view的坐标系（以view的左上角为原点(0, 0)）
  调用时传入的view参数为nil的话，返回的是触摸点在UIWindow的位置
*/
- (CGPoint)locationInView:(UIView *)view;

// 该方法记录了前一个触摸点的位置
- (CGPoint)previousLocationInView:(UIView *)view;
{%endhighlight%}
因为iPhone支持多点触摸，所以，iOS会把若干个UITouch对象放在一个NSSet中。这个NSSet又被UIEvent所包含。

### UIEvent
UIEvent有几下几个属性。
{% highlight objc linenos %}
// 事件类型
@property(nonatomic,readonly) UIEventType     type NS_AVAILABLE_IOS(3_0);
@property(nonatomic,readonly) UIEventSubtype  subtype NS_AVAILABLE_IOS(3_0);
// 时间戳
@property(nonatomic,readonly) NSTimeInterval  timestamp;
// 所有UITouch对象
@property(nonatomic, readonly, nullable) NSSet <UITouch *> *allTouches;
{%endhighlight%}

### UIEvent的传递过程
每个App都有很多个UIView，每个UIView都是响应者。那么，当手指在上面触摸时，该怎么知道我们触摸了那个UIView呢？

首先，每个App都有一个单例UIApplication。我们的触摸事件首先会被iOS传给UIApplication管理的一个队列中。然后，依次取出事件来分发。一般会发给keyWindow。然后keyWindow会通过hitTest方法，递归地在它的subView中找最适合响应UIEvent的UIView。大概是这么实现的：

{%highlight objc linenos%}
- (UIView *)hitTest:(CGPoint)point withEvent:(UIEvent *)event
{
    // 1.判断当前View能否接收事件
    if (self.userInteractionEnabled == NO || self.hidden == YES || self.alpha <= 0.01) return nil;
    // 2.判断点在不在当前控件
    if ([self pointInside:point withEvent:event] == NO) return nil;
    // 3.从后往前遍历自己的子控件
    for (UIView *subView in self.subviews.reverseObjectEnumerator) {
        CGPoint subPoint = [subView convertPoint:point fromView:self];
        UIView *subTouchView = [subView hitTest:subPoint withEvent:event];
        if (subTouchView) {
            return subTouchView;
        }
    }
    // self是最合适的view
    return self;
}
{%endhighlight%}

### 响应者链条
通过上一步，我们找到了最合适的UIView。但是，这并不意味着该UIView会处理该UIEvent。

它可以调用touches方法来处理事件，也可以把事件传递给它的下一个响应者。（默认的touches方法即不处理）

传递的路径如图所示：
![image](https://developer.apple.com/library/content/documentation/EventHandling/Conceptual/EventHandlingiPhoneOS/Art/iOS_responder_chain_2x.png)
如果我们override该UIView的touches方法，先写上处理的方法，再调用super的touches方法，那么就可以实现让多个UIView响应同一个事件。

### 一个简单的例子
下面我们自定义一个UIView，当点击该View时，弹出键盘并响应输入。类似微信输入密码的效果。
![image](https://github.com/bitnpc/bitnpc.github.io/raw/master/_posts/img/codeInput.png)

{%highlight objc linenos%}
static const NSInteger maxDigit = 6;

@interface PasswordView : UIView (UIKeyInput)

@property (nonatomic, strong) NSMutableString *textStore;

@end

@implementation PasswordView

- (instancetype)initWithFrame:(CGRect)frame
{
    self = [super initWithFrame:frame];
    _textStore = [NSMutableString string];
    return self;
}

- (BOOL)canBecomeFirstResponder
{
    return YES;
}

- (void)touchesBegan:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event
{
    if ([self isFirstResponder] == NO) {
        [self becomeFirstResponder];
    }
}

- (void)touchesMoved:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event
{

}

- (void)touchesEnded:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event
{

}

- (void)touchesCancelled:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event
{

}

// ====UIKeyInput=====
- (BOOL)hasText
{
    return self.textStore.length > 0;
}

- (void)insertText:(NSString *)text 
{
    if ([text isEqualToString:@"\n"]) {
        [self resignFirstResponder];
        return;
    }
    if (self.textStore.length < maxDigit) {
        [self.textStore appendString:text];
        [self setNeedsDisplay];
    }
}

- (void)deleteBackward 
{
    if (self.textStore.length > 0) {
        [self.textStore deleteCharactersInRange:NSMakeRange(self.textStore.length - 1, 1)];
    }
    [self setNeedsDisplay];
}

- (UIKeyboardType)keyboardType 
{
    return UIKeyboardTypeNumberPad;
}

- (void)drawRect:(CGRect)rect
{
    CGFloat width = rect.size.width;
    CGFloat height = rect.size.height;
    CGFloat itemWidth = ceilf(width / maxDigit);
    CGContextRef context = UIGraphicsGetCurrentContext();
    // 画外框
    CGContextSetRGBStrokeColor(context, 0.5, 0.5, 0.5, 0.5);
    CGContextSetLineWidth(context, 2.0);
    CGContextAddRect(context, CGRectMake(1, 1, width - 2, height - 2));
    // 画分割线
    for (NSInteger i = 1; i < maxDigit; i++) {
        CGContextMoveToPoint(context, i * itemWidth, 0);
        CGContextAddLineToPoint(context, i * itemWidth, height);
        CGContextClosePath(context);
    }
    CGContextStrokePath(context);
    // 画小黑点
    CGContextSetFillColorWithColor(context, [UIColor blackColor].CGColor);
    for (NSInteger i = 1; i <= _textStore.length; i++) {
        CGContextAddArc(context, i * itemWidth - itemWidth / 2, height / 2, 5, 0, M_PI * 2, YES);
        CGContextDrawPath(context, kCGPathFill);
    }
}

@end

{%endhighlight%}

以上的Demo实现了点击PasswordView, PasswordView响应了此次点击事件，弹出键盘，输入数字的功能。

假如我们添加了两个如上的PasswordView，PA和PB，PB是PA的subView，并且超过了PA的bounds。如下图所示：

![image](https://github.com/bitnpc/bitnpc.github.io/raw/master/_posts/img/viewOutOfBounds.png)

其中，PA是白色的输入框，PB是绿色的输入框。

下面我们来讨论这三种情况。

1. UITouch的location在PB内，但是在PA外。根据我们之前hitTest的示例代码，PA和PB均不会响应此UIEvent。只能由ViewController的View响应，但ViewController的View默认不响应，所以我们看到的结果就是ViewController的touches方法被调用（UIViewController亦继承自UIResponder）。

2. UITouch的location在PB内，也在PA内。即PA和PB的叠加部分。由hitTest代码可知，PB优先响应事件。如果让PB resignFirstResponder（比如输入换行的时候resignFirstResponder），键盘并不会立刻消失。此时会调用PA的canBecomeFirstResponder方法，返回YES，使得PA成为了firstResponder。再次换行，PA也resignFirstResponder，这时候键盘才会消失。

3. UITouch的location在PB外，但在PA内。则PA的pointInside方法返回YES，PB的pointInside返回NO，显然是PA响应事件。

当然，也可以修改默认的pointInside方法，使得PB的pointInside也返回YES，就能使得PB先响应事件了。