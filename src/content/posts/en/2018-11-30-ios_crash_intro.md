---
title: 'Exploring Crashes in iOS'
pubDate: 2018-11-28
categories: [Tech, iOS]
tags: 
    - Crash
    - iOS
    - Exception Handling
toc: true
description: 'A comprehensive guide to iOS crashes covering their nature as exception control flow, common causes, capture mechanisms, investigation methods, and governance.'
---

## Overview

A crash is the occasional "app freeze and exit" we encounter while using apps, directly impacting user experience and retention. The crash rate is one of the key metrics for measuring app quality.
```alert
type: success
description: Typically, mainstream apps keep their crash rate below 0.05%, meaning no more than 5 crashes per 10,000 launches.
```

This article focuses on the iOS ecosystem, combining system principles with practical experience, to systematically cover the following aspects of crashes:
- **Nature**: The mechanism of Exception Control Flow (ECF)
- **Causes**: Common causes sorted by frequency
- **Propagation flow**: Two distinct paths for low-level errors and high-level language errors
- **Investigation methods**: Tools for locating, reproducing, and debugging
- **Case study**: The conflict between KVO and dynamic class creation
- **Governance system**: Monitoring, prevention, and quality assurance

Helping developers build a stable crash quality assurance process.

## 1. The Nature of Crashes

### 1.1 Exception Control Flow (ECF)

A crash is essentially an **Exception Control Flow (ECF)** triggered by the operating system in response to an abnormal situation. When the CPU, kernel, or runtime detects an unrecoverable exception, the control flow jumps to an exception handler, ultimately potentially causing the process to exit.

ECF can occur at the hardware, kernel, and application layers:

- **Hardware layer**: Hardware detects an event (e.g., an I/O interrupt) and notifies the CPU
- **Kernel layer**: Kernel scheduling, context switching, or signal dispatching
- **Application layer**: The runtime or application logic actively throws exceptions or sends signals

Mobile app crashes primarily relate to the kernel and application layers, so the following discussion focuses on these two layers.

### 1.2 OS Exception Classification

Operating systems classify exceptions into four categories: interrupts, traps, faults, and aborts. This classification comes from Chapter 8 of *Computer Systems: A Programmer's Perspective*. Although some sources argue that interrupts are not exceptions, from the perspective of "the program not executing as originally intended," they can be considered part of a broader definition of exceptions.

| Category | Cause | Async/Sync | Return Behavior |
|----------|-------|------------|-----------------|
| Interrupt | Signal from I/O device | Asynchronous | Always returns to the next instruction |
| Trap | Intentional exception | Synchronous | Always returns to the next instruction |
| Fault | Potentially recoverable error | Synchronous | May return to the current instruction |
| Abort | Unrecoverable error | Synchronous | Does not return |

The most common type leading to crashes in everyday development is **fault**, i.e., a potentially recoverable error. Once a fault cannot be repaired (e.g., a segmentation fault accessing invalid memory), the system sends a signal to the process or terminates it directly, manifesting as a crash. Common examples like `EXC_BAD_ACCESS` and `SIGSEGV` fall into this category.

### 1.3 Application-Layer Exception Protection

Different runtimes have their own exception systems. The Java JVM manages exceptions through the `Throwable -> Error / Exception` abstraction hierarchy; most Android crashes are caught by the JVM and converted into Java stack traces.

The iOS runtime (Objective-C Runtime / Swift Runtime) also provides exception protection mechanisms, for example:

- `unrecognized selector sent to instance`: triggered when sending an unknown message to an object
- `objc_exception_throw`: `NSException` thrown by Objective-C
- Swift-level `fatalError` and `preconditionFailure` trigger `SIGABRT`

These protections can prevent an exception from falling directly to the kernel layer, but when an exception goes unhandled or escalates to a fatal error, it will still ultimately present as a crash.

## 2. Common Causes of Crashes

The reasons for app crashes vary. Sorted by actual frequency from high to low, they mainly fall into the following four categories:

### 2.1 Invalid Memory Access (Most Common)

This is the most common type of crash in iOS development, typically manifesting as `EXC_BAD_ACCESS` or `SIGSEGV`. It mainly includes:

- **Dangling pointers**: Using a deallocated object, or failing to set a pointer to `nil` after the object is released
- **Out-of-bounds access**: Accessing beyond the bounds of arrays, strings, and other containers
- **Multithreading race conditions**: Contention in writing to the same memory from multiple threads, causing memory corruption
- **Writing to protected memory**: Attempting to modify a read-only memory region (e.g., string literals)

At the application level, the memory layout diagram helps illustrate common issues:

![Desktop View](../../../assets/images/posts/post-2018-11-30/memory_layout.svg)

From low address to high address: Code segment (`.text`) → Initialized data (`.data`) → Uninitialized data (`.bss`) → Heap → Stack
```alert
type: info
description: **Memory layout note**: In most architectures, the stack is typically located in the high address region and grows downward; the heap is below the stack and grows upward. Different architectures may have slight variations in memory layout.
```

Common crash scenarios during process execution include:

- Using a deallocated object (dangling pointer)
- Contention in writing to the same memory from multiple threads
- Out-of-bounds access on arrays or structs

### 2.2 Language Runtime Protection Mechanisms Triggered

The iOS runtime (Objective-C Runtime / Swift Runtime) provides exception protection mechanisms that actively throw exceptions or trigger crashes when anomalous conditions are detected:

- **Unrecognized message**: Objective-C Runtime catches `unrecognized selector sent to instance`
- **Container out-of-bounds / inserting `nil`**: Foundation and Swift containers actively throw exceptions or call `fatalError`
- **Type assertion failure**: Swift's `as!` or `try!` failure triggers `SIGABRT`
- **Force unwrapping `nil`**: Swift's `!` force unwrap encountering `nil` triggers `SIGABRT`

Low-level languages like C do not provide these protections; out-of-bounds access often results in reading or writing undefined memory directly.
```alert
type: info
description: **Language protection differences**: The C language provides no runtime protection — out-of-bounds access won't crash immediately but leads to undefined behavior, potentially causing data corruption or security vulnerabilities. In contrast, Objective-C/Swift runtime protection mechanisms actively throw exceptions when anomalies are detected. While this may cause a crash, it helps identify problems earlier.
```

The following code compares the behavior of C and Objective-C when accessing an array out of bounds:

```objc
int main () {
    // C language: out-of-bounds access won't crash, but behavior is undefined
    char str[6] = {'b','i','t','n','p','c'};
    char c = str[6];                    // Won't crash, but reads undefined memory
    printf("%c\n", c);                  // Prints an unknown character

    // Objective-C: out-of-bounds access will crash
    NSArray *array = @[@"b", @"i", @"t", @"n", @"p", @"c"];
    id obj = array[6];                  // Crash: index 6 beyond bounds [0 .. 5]
    NSLog(@"%@\n", obj);
}
```

### 2.3 OS Policy Restrictions

The iOS system may actively terminate an app based on resource management, security policies, and other factors:
```alert
type: info
description: **System protection mechanisms**: These policies are important means by which iOS protects user experience and device security. Developers need to understand these mechanisms and pay attention to resource usage and performance optimization during development to avoid triggering system protections.
```

- **WatchDog**: The system monitors the main thread and app launch duration. If the UI main thread freezes beyond the threshold or cold launch times out, WatchDog kills the app
- **Memory pressure**: Receiving `didReceiveMemoryWarning` without releasing resources in time, or a background app exceeding memory limits, prompts the system to reclaim the process
- **Heat and power consumption**: Prolonged high CPU/GPU load can trigger system frequency scaling or even force-quit the foreground app (relatively rare)
- **Code signing / certificate issues**: Expired enterprise certificates, invalid signatures, and signature verification failures in jailbroken environments can cause the system to terminate the app during launch

### 2.4 CPU Unable to Execute Code (Relatively Rare)

These crashes are typically caused by low-level hardware or instruction-level errors and are relatively rare in everyday development:

- **Illegal arithmetic operations**: Dividing by zero, floating-point overflow, etc., can trigger `SIGFPE`
- **Invalid instructions**: Executing undefined or architecture-unsupported instructions at runtime triggers `SIGILL`, commonly seen when mixing binaries of different architectures or with incorrect function pointers

## 3. Crash Capture and Propagation Flow

There are two main paths for crash propagation in iOS, depending on the source of the error:

**Path One: Low-level errors** (e.g., dangling pointers, illegal memory access)
- Hardware/kernel detects an exception → Mach exception → Unix Signal
- These errors are caught directly by the lower layers of the system, bypassing the language runtime

**Path Two: High-level language errors** (e.g., array out-of-bounds, unrecognized selector)
- Objective-C/Swift Runtime detects → NSException → Uncaught, calls `abort()` → SIGABRT
- These errors are actively thrown by the language runtime; if no exception handler is set, they ultimately trigger a signal via `abort()`
```alert
type: success
description: **Key insight**: Understanding the difference between these two paths is crucial. Errors on Path One cannot be caught via NSException — you must register a signal handler. Errors on Path Two can be caught via an NSException handler providing more detailed error information (exception name, reason, etc.), but if left unhandled, they will ultimately trigger a signal.
```

To better understand the differences between the two paths, here are common crash scenarios:

**Scenario 1: Pure signal crash (no NSException)**

These crashes are triggered directly by the underlying system, bypassing the language runtime, so there is no corresponding NSException — they can only be caught via signals:

- **Dangling pointer access** → `SIGSEGV`
- **Stack overflow** → `SIGTRAP`
- **Memory limit** → `SIGKILL`

**Scenario 2: Signal triggered by NSException**

These crashes are detected by the language runtime, which throws an NSException; if uncaught, a signal is triggered. The specific error information needs to be obtained through the NSException layer:

- **Array out-of-bounds** → `NSRangeException` → `SIGABRT`
- **Message forwarding failure** → `NSInvalidArgumentException` → `SIGABRT`
- **Swift optional force unwrap of nil** → `NSException` → `SIGABRT`
```alert
type: success
description: **Capture strategy**: Understanding the difference between these two paths helps in registering handlers at the appropriate layers to collect information. Typically, handlers need to be registered at multiple layers simultaneously (Mach exception, Unix Signal, NSException) to obtain complete context. Finally, the captured crash logs should be symbolicated into readable stack traces.
```

### 3.1 Mach Exception

Mach exceptions are the lowest-level kernel exceptions, such as `EXC_BAD_ACCESS`. When an exception occurs, it is converted into a Mach message by the exception handler, then delivered sequentially to the thread, task, and host ports.

By listening on these ports, Mach-level exceptions can be captured. Below is an example using `PLCrashReporter` (only key code is listed; see [PLCrashMachExceptionServer](https://github.com/plausiblelabs/plcrashreporter/blob/master/Source/PLCrashMachExceptionServer.m) for the full implementation):

```objc
// Initialize Mach exception server context
// 1. Create server port
mach_port_allocate(mach_task_self(), MACH_PORT_RIGHT_RECEIVE, &_serverContext->server_port);

// 2. Create notification port
mach_port_allocate(mach_task_self(), MACH_PORT_RIGHT_RECEIVE, &_serverContext->notify_port);
mach_port_insert_right(mach_task_self(), _serverContext->notify_port,
                       _serverContext->notify_port, MACH_MSG_TYPE_MAKE_SEND);

// 3. Create port set
mach_port_allocate(mach_task_self(), MACH_PORT_RIGHT_PORT_SET, &_serverContext->port_set);

// 4. Add server port and notification port to the port set
mach_port_move_member(mach_task_self(), _serverContext->server_port, _serverContext->port_set);
mach_port_move_member(mach_task_self(), _serverContext->notify_port, _serverContext->port_set);

// 5. Create exception handling thread
pthread_create(&thr, &attr, &exception_server_thread, _serverContext);
```

Open-source solutions like PLCrashReporter and KSCrash register Mach exception ports at the low level, intercept exceptions in advance, persist the stack trace, and then hand the exception back to the system's normal delivery flow, ensuring default behavior is not disrupted.
```alert
type: info
description: **Important notes**:
- Even if a Mach exception handler is registered, it does not affect the original delivery flow. The Mach exception will continue to propagate to the Unix layer and be converted into a `Unix Signal`
- If the Mach exception handler terminates the process directly, the corresponding Unix signal may not be generated
- A single Mach exception typically corresponds to one or more `Unix Signals`
```

#### Common exception_type Values

| Exception Type | Description | Notes |
|---------------|-------------|-------|
| `EXC_BAD_ACCESS` | Bad Memory Access | Invalid memory address — either the address does not exist or the current process lacks permission to access it. Commonly seen in Path One (low-level errors) |
| `EXC_CRASH` | Abnormal Exit | Usually accompanied by the `SIGABRT` `UNIX Signal`, indicating an abnormal process exit. Commonly seen in Path Two (high-level language errors) when an uncaught NSException triggers `abort()` |
| `EXC_BAD_INSTRUCTION` | Illegal Instruction | Illegal or undefined instruction or operand. Commonly seen in Path One (low-level errors) |

### 3.2 Unix Signal

Unix Signal is an asynchronous notification mechanism in Unix systems. For low-level errors (Path One), Mach exceptions are converted into corresponding `Unix Signals` by `ux_exception` at the host layer, and `threadsignal` delivers the signal to the faulting thread, such as `SIGSEGV` or `SIGBUS`. For high-level language errors (Path Two), an uncaught NSException calls `abort()`, directly triggering `SIGABRT`.

At the Unix layer, the `signal` / `sigaction` functions can be used to register signal handler callbacks, recording critical information to a file or uploading it to a server. The following code uses a single `signalHandler` to handle received `SIGBUS`:

```c
void signalHandler(int sig) {
    printf("signal %d received.\n", sig);
    // Here you can save stack info, write logs, etc.
    exit(1);
}

int main() {
    signal(SIGBUS, signalHandler);
    char *str = "bitnpc";  // String literal in read-only segment
    str[0] = 'H';          // Attempt to modify read-only memory, triggers SIGBUS
    return 0;
}
```

#### Common Unix Signals

The following table lists common `Unix Signals`. On macOS, you can type `man signal` to see the full list of signals. It can also be found [here](https://github.com/torvalds/linux/blob/master/include/linux/signal.h).

| Unix Signal | Description |
|------------|-------------|
| `SIGSEGV` | Access to an invalid memory address — the address exists but the current process does not have permission to access it. This is a hardware-level error |
| `SIGABRT` | Abnormal program termination, typically triggered by the C `abort()` function, or by runtime assertion failures, Swift's `fatalError`, etc. This is a software-level error |
| `SIGBUS` | Access to an invalid memory address — the difference from `SIGSEGV` is that `SIGBUS` indicates the memory address does not exist. This is a hardware-level error |
| `SIGTRAP` | Debugger-related |
| `SIGILL` | Attempt to execute an illegal, unknown, or unauthorized instruction |

### 3.3 NSException

`NSException` is an exception object thrown by the Objective-C runtime, typically triggered by the language runtime's protection mechanisms (e.g., array out-of-bounds, unrecognized selector, etc.). By registering a handler function via `NSSetUncaughtExceptionHandler`, you can capture the exception name, reason, and call stack before a crash and persist them. A common practice is to write this information to a sandbox file in the handler and upload it on the next app launch, avoiding complex logic at the crash site.
```alert
type: warning
description: **Warning**: If no exception handler is set or the handler does not prevent the program from continuing, an uncaught NSException will cause the program to call `abort()`, which triggers the `SIGABRT` signal. Therefore, be sure to save critical information in the handler and avoid performing time-consuming operations at the crash site.
```

The following code demonstrates basic usage:

```objc
void exceptionHandler(NSException *exception) {
    // Retrieve exception information
    NSString *name = [exception name];                          // Exception name
    NSString *reason = [exception reason];                      // Reason for the exception
    NSArray *stackArray = [exception callStackSymbols];         // Exception stack trace

    // Persist exception information (write to file or upload to server)
    NSLog(@"Exception: %@, Reason: %@", name, reason);
    NSLog(@"Stack: %@", stackArray);

    // Note: Do not perform time-consuming operations here to avoid compromising crash log integrity
}

int main(int argc, char * argv[]) {
    // Register uncaught exception handler
    NSSetUncaughtExceptionHandler(&exceptionHandler);

    // Example of triggering an exception
    NSArray *array = @[@"b", @"i", @"t", @"n", @"p", @"c"];
    id obj = array[6];  // Triggers NSRangeException
    return 0;
}
```

### 3.4 Crash Log Symbolication

The data obtained after capturing a crash consists of virtual memory addresses. We need to translate these virtual memory addresses into readable stack traces. The essence of symbolication is to find the method name corresponding to a memory address in a mapping file.

Common symbolication methods include:

- **Xcode Organizer / Devices panel**: Automatic symbolication, suitable for local debugging
- **symbolicatecrash script**: Offline symbolication, suitable for batch processing
- **atos / atosl**: Locate symbols by address, useful for custom-built platforms
```alert
type: success
description: **Symbolication best practices**: Symbol files for project code are stored in `dSYM` and should be archived and associated with version numbers after each build. System library symbols can be obtained from iOS firmware or third-party images. Enterprise teams typically integrate symbol file upload in their CI pipeline, enabling crash platforms (e.g., Firebase Crashlytics, Tencent Bugly, Sentry, custom platforms) to automatically resolve crashes.
```

## 4. Crash Investigation Approach

Under normal circumstances, crashes that occur during debugging are easy to fix. However, after an app is released, crashes that were never seen locally and are difficult to reproduce often appear. The crash log alone often does not directly pinpoint the problem, requiring a systematic investigation approach.
```alert
type: info
description: **Investigation principles**: Investigating production crashes requires patience and a systematic approach. Don't jump to conclusions — gather sufficient information, try multiple reproduction methods, and use debugging tools to assist when necessary.
```

### 4.1 Locating Phase

- **Gather clues**: Confirm system version, app version, user operation path, stack trace, thread information, device model, battery level, network environment, etc.
- **Reconstruct the scene**: Use event tracking or operation replay logs (e.g., Logan, Matrix) to identify the trigger path
- **Quick comparison**: Compare differences with the previous version, paying attention to recently merged modules and experiment toggles

### 4.2 Attempting Reproduction

- **Local reproduction**: Use breakpoints to trace back and feature toggles to precisely hit the crash path
- **Increase hit rate**: Enable `Malloc Scribble`, `NSZombie`, `Thread Sanitizer`, `Address Sanitizer` in Xcode's `Diagnostics`
- **Multithreading scenarios**: Write scripts to trigger the issue concurrently across multiple threads to increase the probability of reproduction

### 4.3 Common Memory Debugging Tools

#### Malloc Scribble

The principle is to fill deallocated objects with `0x55`, ensuring that dangling pointer calls will inevitably crash.
```alert
type: info
description: **Usage limitations**: Malloc Scribble is only effective in local `debug` builds. To achieve similar functionality in internal test builds, you would need to hook the `free` function in the system library.
```

Take the following code as an example (ARC is disabled for clarity):

```objc
UIView *view = [UIView new];
[view release];
[view setNeedsLayout];  // Sending a message to a deallocated object
```

Clearly, the object `view` points to has been deallocated, but the `view` pointer was not set to `nil`. So we are sending a message to a deallocated object. However, upon compilation and execution, we find that it does not crash.

After enabling `Malloc Scribble`, you can clearly see from the debug panel that a crash occurs at the third line.

#### Zombie Object

Deallocated objects are marked as zombie objects. Xcode accomplishes this using the runtime method `object_setClass`, overwriting the isa of the released view to `_NSZombie_UIView`.

In addition to the aforementioned `Memory Management` tools, Xcode also provides `Runtime Sanitization` tools (actually features provided by the LLVM compiler). For example, `Thread Sanitizer` can detect race condition access, helping developers identify potential issues.
```alert
type: success
description: **Debugging tool recommendations**: Fully leveraging Xcode's diagnostic tools during development can catch most memory and thread safety issues before release. It is recommended to perform comprehensive checks with these tools before key version releases.
```

## 5. Case Study: Conflict Between KVO and Dynamic Class Creation

This is a real production crash case, demonstrating the conflict between dynamic class creation and KVO mechanisms in a multithreaded environment.
```alert
type: warning
description: **Case background**: This is a typical thread safety issue. When dynamically creating classes in a multithreaded environment without proper synchronization mechanisms, crashes are very likely. Such problems are often difficult to reproduce in production and require careful analysis of the stack trace.
```

Below is a real crash log, with irrelevant parts omitted for readability.

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

### 5.1 Problem Analysis

First, let's search through the stack trace. The searchable part of the stack is lines 0-6. For example, searching for `objc_registerClassPair` — it is a method called by the runtime when creating a class. But this information alone is insufficient to pinpoint the issue.

From the fourth line of the stack, we found articles about crashes caused by KVO creating classes with duplicate names. However, this project is componentized, and each pod has a different prefix, so there should be no issue with multiple symbols coexisting in different binaries.

Next, let's see if we can reproduce the issue. Navigate to the page corresponding to `TPKxxxViewModel` and find that no crash occurs. Considering that the crash thread is a background thread, it is very likely a problem caused by creating `TPKxxxItem` from multiple threads. We can write some test code to try to reproduce it. Note that the timing of this code execution should match when the item would actually be created.

```objc
// Concurrently creating objects from multiple threads to attempt reproduction
for (int i = 0; i < 5; i++) {
    dispatch_async(dispatch_get_global_queue(DISPATCH_PRIORITY_DEFAULT, 0), ^{
        TPKxxxItem *item = [[TPKxxxItem alloc] initWithText:@"bit" jumpUrlString:@"npc"];
    });
}
```

Fortunately, we successfully reproduced it. The crash occurred in a foundational library within the project. Checking the change log of that library revealed some new swizzle operations. One step in that class involves a KVO-like mechanism that creates a new class during the process. However, subsequent operations also observe the same class via KVO. So, our problem boils down to KVO crashing when creating a subclass with the same name, which aligns with the information gathered earlier.

### 5.2 Analysis of the KVO Mechanism

So why does KVO crash when creating a subclass with the same name? We know that KVO mainly does the following:

1. Uses `objc_allocateClassPair` and `objc_registerClassPair` to dynamically create a new class: `NSKVONotifying_xxx`, which is a subclass of the original class
2. Points the original object's `isa` pointer to the newly created `NSKVONotifying_xxx` class
3. Adds the new class to the global class table
4. Overrides the new class's setter method to call `willChangeValueForKey:` and `didChangeValueForKey:`

In step one, what happens if two new classes with the same name are created? We can write test code to verify:

```objc
- (void)applicationDidFinishLaunching:(NSNotification *)aNotification {
    // First creation of class with the same name, succeeds
    Class testClass1 = objc_allocateClassPair([NSObject class], "bitnpc_crash_test", 0);
    objc_registerClassPair(testClass1);

    // Second creation of class with the same name, objc_allocateClassPair returns nil
    Class testClass2 = objc_allocateClassPair([NSObject class], "bitnpc_crash_test", 0);
    objc_registerClassPair(testClass2);  // EXC_BAD_ACCESS: Passing nil causes crash
}
```

When calling `objc_allocateClassPair`, the returned `class` is `nil`. Then, when registering the new class with `objc_registerClassPair`, the `nil` parameter causes the crash.

Looking at the `objc-runtime` source code (objc4-723), we can see that if `getClass(name)` returns a non-nil class, it directly returns `nil` without allocating new memory:

```objc
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
        return nil;  // Class name already exists, return nil
    }

    // Allocate new classes.
    cls  = alloc_class_for_subclass(superclass, extraBytes);
    meta = alloc_class_for_subclass(superclass, extraBytes);

    // fixme mangle the name if it looks swift-y?
    objc_initializeClassPair_internal(superclass, name, cls, meta);

    return cls;
}
```

### 5.3 Root Cause and Solution

At this point, the cause is very clear. The following flowchart illustrates the problem:

![Desktop View](../../../assets/images/posts/post-2018-11-30/case_crash_flow.png)

A foundational library in the project created two `TPKxxxItem_XXX` classes — let's call them intermediate classes. When KVO tried to create subclasses from these two intermediate classes, it failed to allocate memory space, causing `objc_registerClassPair` to crash.
```alert
type: success
description: **Solution**: When creating intermediate classes, lock on `self.class` to ensure only one intermediate class is generated. Using `dispatch_once` or `@synchronized` can both achieve thread safety, with `dispatch_once` recommended for better performance.
```

```objc
// Use dispatch_once or locking to ensure thread safety
static NSMutableDictionary *classCache = nil;
static dispatch_once_t onceToken;
dispatch_once(&onceToken, ^{
    classCache = [NSMutableDictionary dictionary];
});

@synchronized(self.class) {
    NSString *className = NSStringFromClass(self.class);
    Class cachedClass = classCache[className];
    if (!cachedClass) {
        // Create intermediate class
        cachedClass = objc_allocateClassPair([self class], "TPKxxxItem_XXX", 0);
        if (cachedClass) {
            objc_registerClassPair(cachedClass);
            classCache[className] = cachedClass;
        }
    }
    return cachedClass;
}
```
```alert
type: info
description: **Note**: The reason generating `TPKxxxItem_XXX` didn't crash is that when multiple threads attempt to create a class with the same name, `objc_allocateClassPair` may not always return `nil` — this depends on the underlying container implementation. The framework in question had a check: when `objc_allocateClassPair` returned `nil`, it would not proceed with the register operation. However, KVO apparently does not have such a check.
```
```alert
type: success
description: **Lessons learned**: When dynamically generating classes or methods at runtime, be mindful of thread safety and naming conflicts. Use locking or serial queues when necessary to avoid duplicate registration under multithreading. This is one of the common pitfalls in iOS development.
```

## 6. Crash Monitoring and Governance System
```alert
type: success
description: **Governance principles**: Crash governance is an ongoing process that requires establishing a closed-loop system of monitoring, analysis, fixing, and prevention. The key is to identify and resolve issues before they impact users.
```

- **Core metrics**: Focus on cold-start crash rate, active-user crash rate (percentage of DAU users who crash), and scenario crash rate (broken down by page/feature), combined with metrics on lag and OOM
- **Collection strategy**: The client reports crash logs, thread stacks, device information, and recent actions on the next launch; the server aggregates data to compute metrics
- **Governance loop**: Combine build information and canary batches to bucket crashes (first occurrence, regression, core path), set SLAs and alert thresholds
- **Toolchain**: Common solutions include Crashlytics, Bugly, Sentry, or a custom reporting system built on PLCrashReporter; cross-validate with Xcode Organizer and App Store Connect's `Metrics`/`Analytics`
- **Prevention mechanisms**: Enable debugging tools like ASan, TSan, Malloc Guard, and Zombie in internal test builds; use static analysis (Clang Static Analyzer, Infer) and unit tests to cover key modules; leverage Feature Flags for quick degradation in production

## 7. Summary

This article, grounded in the operating system's exception control mechanism, has examined the nature of crashes, common causes, propagation flow, capture layers, and symbolication methods, along with investigation approaches and a real-world case study.
```alert
type: success
description: **Quality assurance system**: To continuously reduce the crash rate, you need to establish front-line prevention during development, comprehensive monitoring and regression testing at release, and ongoing metric tracking with rapid damage control in operations, forming a top-down quality closed loop. This is a systematic effort requiring team collaboration and continuous improvement.
```

### Key Takeaways

1. **Nature of crashes**: Exception Control Flow (ECF), a multi-layered exception handling mechanism from the hardware layer to the application layer
2. **Common causes** (by frequency): Invalid memory access (most common) → Language runtime protection mechanisms → OS policy restrictions → CPU unable to execute code (relatively rare)
3. **Propagation flow**: Two main paths
   - Path One (low-level errors): Mach exception → Unix Signal
   - Path Two (high-level language errors): NSException → `abort()` → SIGABRT
   - Handlers should be registered at multiple layers to capture complete information
4. **Investigation approach**: Gather clues → Reconstruct scene → Attempt reproduction → Locate problem → Fix and verify
5. **Best practices**: Thread safety, naming conventions, monitoring system, toolchain construction
