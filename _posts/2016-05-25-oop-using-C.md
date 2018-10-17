---
layout: post
title: "用C语言来实现Objective-C的面向对象方法"
date: 2016-05-25
categories:: C && iOS
---
### 1.封装

#### Objective-C
{% highlight objc linenos %}
@interface BaseClass : NSObject
 
@property (nonatomic, assign) NSInteger value;
 
- (void)baseMethod;
 
@end
 
@implementation BaseClass
 
- (void)baseMethod
{
    NSLog(@"BaseClass's method\n");
}
 
@end
 
int main(int argc, char * argv[]) {
    BaseClass *baseObject = [BaseClass alloc] init];
    baseObject.value += 1;
    [baseObject baseMethod];
}
 
{% endhighlight %}

#### C
{% highlight c linenos %}
typedef struct BaseClass {
    int value;
} BaseClass;
 
void baseMethod(BaseClass *pThis)
{
    printf("BaseClass's method\n");
}
 
BaseClass *NewBaseObject()
{
    BaseClass *baseObject = malloc(sizeof(BaseClass));
    baseObject->value = 0;
    return baseObject;
}
 
int main()
{
    BaseClass *baseObject = NewBaseObject();
    baseObject->value += 1;
    baseMethod(baseObject);
}
 
{% endhighlight %}

### 2.继承

#### Objective-C
{% highlight objc linenos %}
@interface DerivedClass : BaseClass
 
@property (nonatomic, assign) NSInteger derivedValue;
- (void)derivedMethod;
 
@end
 
@implementation DerivedClass
 
- (void)derivedMethod
{
    NSLog(@"DerivedClass's method\n");
}
 
@end
 
int main(int argc, char * argv[]) {
    DerivedClass *derivedObject = [[DerivedClass alloc] init];
    derivedObject.value += 2;
    derivedObject.derivedValue += 3;
    [derivedObject baseMethod];
    [derivedObject derivedMethod];
}
{% endhighlight %}

#### C
{%highlight objc linenos %}
typedef struct DerivedClass {
    BaseClass *pBase;
    int derivedValue;
} DerivedClass;
 
DerivedClass *NewDerivedObject()
{
    BaseClass *pBase = NewBaseClass();
    DerivedClass *pDerived = (DerivedClass *)malloc(sizeof(DerivedClass));
    pDerived->pBase = pBase;
    pDerived->derivedValue = 0;
    return pDerived;
}
 
void derivedMethod(DerivedClass *pThis)
{
    printf("DerivedClass's method\n");
}
 
int main()
{
    DerivedClass *derivedObject = NewDerivedObject();
    derivedObject->value += 2;
    derivedObject->derivedValue += 3;
    derivedMethod(derivedObject);
}
{% endhighlight %}

### 3.多态

#### Objective-C

{% highlight objc linenos %}
@interface VirtualClass : NSObject

- (void)instanceMethod;

@end

@implementation

- (void)instanceMethod
{
    NSLog(@"VirtualClass instance method.\n");
}

@end

@interface OverrideClass : VirtualClass

@end

@implementation

- (void)instanceMethod
{
    NSLog(@"OverrideClass instance method.\n");
}

@end

int main(int argc, char * argv[]) {
    VirtualClass *virtualObject = [[VirtualClass alloc] init];
    [virtualObject instanceMethod];
    
    OverrideClass *overrideObject = [[OverrideClass alloc] init];
    [overrideObject instanceMethod];
    
    VirtualClass *vObjectObject = [[OverrideClass alloc] init];
    [vObjectObject instanceMethod];
}
{% endhighlight %}

#### C
{% highlight c linenos%}
typedef struct VirtualClass {
    int value;
    void (*pVirtual)(struct VirtualClass *);
} VirtualClass;

void VirtualMethod_VirtualClass(VirtualClass *pThis)
{
    printf("VirtualClass instance method.\n");
}

VirtualClass * NewVirtualObject()
{
    VirtualClass *p = malloc(sizeof(VirtualClass));
    p->value = 0;
    p->pVirtual = VirtualMethod_VirtualClass;
    return p;
}

typedef struct OverrideClass {
    int value;
    VirtualClass *pBase;
} OverrideClass;

void OverrideMethod_OverrideClass()
{
    printf("OverrideClass instance method.\n");
}

OverrideClass *NewOverrideObject()
{
    OverrideClass *overrideObject = (OverrideClass *)malloc(sizeof(OverrideClass));
    overrideObject->pBase = NewVirtualObject();
    overrideObject->pBase->pVirtual = OverrideMethod_OverrideClass;
    return overrideObject;
}

int main()
{
    VirtualClass *virtualObject = NewVirtualObject();
    virtualObject->pVirtual(virtualObject);
    
    OverrideClass *overrideObject = NewOverrideObject();
    overrideObject->pBase->pVirtual(overrideObject->pBase);
    
    VirtualClass *v_overrideObject = NewOverrideObject()->pBase;
    v_overrideObject->pVirtual(v_overrideObject);
}
{% endhighlight %}