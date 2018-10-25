---
layout: post
title: "如何实现一个线程安全的NSMutableArray"
date: 2017-03-07
categories:: iOS
---

## NSMutableArray 与 NSArray
我们知道，NSArray是线程安全的，但NSMutableArray不是。那么，如何实现一个线程安全的NSMutableArray呢？

## 使用锁
常见的锁有 pthread_mutex_t, dispatch_semaphore_t, @synchronized, NSLock.
pthread_mutex_t是C语言提供的锁，dispatch_semaphore_t是基于GCD的信号量，@synchronized是Objective-C的互斥锁。NSLock也是Objective-C的锁。

其中，使用dispathc_semaphore_t来给NSMutableArray加锁，性能是最高的。

下面，我们来简单的演示一下。

```
@interface ThreadSafeArray : NSMutableArray

@end

@implementation ThreadSafeArray {
    NSMutableArray *_array;
    dispatch_semaphore_t _lock;
}

#pragma mark --- override init ---
- (instancetype)init
{
    self = [super init];
    _array = [[NSMutableArray alloc] init];
    _lock = dispatch_semaphore_create(1);
    return self;
}

#pragma mark --- override method ---
- (id)objectAtIndex:(NSUInteger)index
{
    dispatch_semaphore_wait(_lock, DISPATCH_TIME_FOREVER);
    id obj = [_array objectAtIndex:index];
    dispatch_semaphore_signal(_lock);
    return obj;
}

- (void)insertObject:(id)obj atIndex:(NSUInteger)index
{
    dispatch_semaphore_wait(_lock, DISPATCH_TIME_FOREVER);
    [_array insertObject:obj atIndex:index];
    dispatch_semaphore_signal(_lock);
    return obj;
}

/*
    其他的方法也类似，在这里不一一列举了。
    self本身是array，为什么要额外加一个array呢？
    因为有些方法会调用其他的方法，直接对self 操作的话，会造成死锁。
*/

@end
```

使用@synchronized也类似。当竞争很少的时候成本很高。

```
- (id)objectAtIndex:(NSUInteger)index
{
    @synchronized(self) {
        return [_array objectAtIndex:index];
    }
}

- (void)insertObject:(id)obj atIndex:(NSUInteger)index
{
    @synchronized(self) {
        [_array insertObject:obj atIndex:index];
    }
}
```

## 更好的方案？
前面用锁的例子很好的实现了线程安全的需求，但是，还不够完美。 .
不妨换一种思路，把所有对数组的操作都放在一个队列里面呢？有人可能会说了，那这样的话，在并发读的时候性能会比较低。
那么我们可不可以实现读的时候并发，写的时候有锁呢？  

下面我们来介绍dispatch barrier(分派屏障)。  

dispatch barrider 可以在并发队列内部创建一个同步点，当它运行时，即使有并发的条件和空闲的CPU，队列中的其他block也不能运行。听起来像是一个互斥锁，确实如此。没有barrier的block可以看作共享锁。只要所有对NSMutableArray的访问都是通过这个队列进行，那么barrier就可以以极低的代价提供同步。  

下面我们来简单实现这个方案。

```
@interface ThreadSafeArray : NSMutableArray

@end

@implementation ThreadSafeArray {
    NSMutableArray *_array;
    dispatch_queue_t _queue;
}

#pragma mark --- override init ---
- (instancetype)init
{
    self = [super init];
    _array = [[NSMutableArray alloc] init];
    _queue = dispatch_queue_create("com.bitnpc.threadSafeArray", DISPATCH_QUEUE_CONCURRENT);
    return self;
}

#pragma mark --- override method ---
- (id)objectAtIndex:(NSUInteger)index
{
    __block id obj;
    dispatch_sync(_queue, ^{
        obj = [_array objectAtIndex:index];
    });
    return obj;
}

- (void)insertObject:(id)obj atIndex:(NSUInteger)index
{
    dispatch_barrier_async(_queue, ^{
        [_array insertObject:obj atIndex:index];
    });
}

@end
```

在这里，我们创建一个concurrent的队列，在读取代码的时候，用dispatch_sync等待读取完成。只要有空闲的CPU，就可以实现并行的读取。  
在写入的时候，用dispatch_barrier_async来确保写入时的互斥访问，通过异步调用，写入代码可以很快返回，同时，可以保证之后总能读取到正确的结果。用GCD中创建barrier的开销很小，所以这种方法比互斥锁快得多。
