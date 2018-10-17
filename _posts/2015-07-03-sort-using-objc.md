---
layout: post
title: "iOS基础--排序"
subtitle: "排序API"
date: 2015-07-03
author: "bitnpc"
header-img: "img/post-bg-kuaidi.jpg"
tags:
    - iOS
    - API
---

Objective-C 有排序的API，省了我们很多事。
主要有以下3种方法。

1.NSComparator
{% highlight objc linenos %}
NSArray *unsortedArray = @[@5,@3,@8,@1,@7];
 
NSArray *sortedArray = [unsortedArray sortedArrayUsingComparator:^NSComparisonResult(id obj1, id obj2) {
    return [obj1 compare:obj2];
}];
{% endhighlight %}
2.NSDescriptor
{% highlight objc linenos %}
NSArray *unsortedArray = @[@5,@3,@8,@1,@7];
 
NSSortDescriptor *aDesc = [[NSSortDescriptor alloc] initWithKey:@"integerValue" ascending:YES];
NSArray *sortedArray2 = [unsortedArray sortedArrayUsingDescriptors:@[aDesc]];
{% endhighlight %}
3.自定义selector
<p>注意到方法一：[obj1 compare:obj2]是NSNumber实现的compare方法，对于自己定义的Model，可以实现自己的compare方法。</p>
{% highlight objc linenos %}
- (NSComparisonResult)compare:(Person *)otherPerson {
	return [self.dateOfBirth compare:otherPerson.dateOfBirth];
}
{% endhighlight %}
