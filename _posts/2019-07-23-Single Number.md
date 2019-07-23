---
layout: post
title: "寻找单独的数字"
date: 2019-07-23
categories:: 编程
tags:
    - leetcode
    - 算法
    - 位运算
---

## 题目
Given a non-empty array of integers, every element appears twice except for one. Find that single one.
 
Example:
```
Input: [4,1,2,1,2]
Output: 4
```
 
此题来源于 [leetcode 第136题](https://leetcode.com/problems/single-number/)。
 
题目中给出一个非空的整数，除了一个数字只出现一次，其他数字都出现了两次。让我们找出只出现一次的数字。 
一个思路是用一个 hashmap 来存储数字与其个数的对应关系，最后找出 count 为 1 的是数字。或者用 hashset 来标记某个数是否存在，存在则删除该数，相当于两两抵消。这两种方式的时间复杂度都是 O(n), 空间复杂度也是 O(n). 代码如下: 

```
class Solution {
public:
    int singleNumber(vector<int> &nums) {
        unordered_set<int> st;
        for (auto num : nums) {
            if (st.count(num)) {
                st.erase(num);
            }else {
                st.insert(num);
            }
        }
        return *st.begin();
    }
};
```

但是这道题要求空间复杂度是 O(1), 那么我们就需要使用位运算来实现。考虑到异或操作的真值表如下: 
 
|   A   |   B   |   A^B   |
|-------|-------|---------|
|   0   |   0   |    0    |
|   0   |   1   |    1    |
|   1   |   0   |    1    |
|   1   |   1   |    0    |
 
可以看出，相同的数字，异或后为 0。也能达到两两抵消的效果。实现代码如下: 
```
class Solution {
public:
    int singleNumber(vector<int> &nums) {
        int res = 0;
        for (auto num: nums) {
            res ^= num;
        }
        return res;
    }
};
```

## 变形题 1
如果数组中重复数字的个数不是 2，而是 3，那么该如何找出那个只出现一次的数呢？ 
[leetcode 第137题](https://leetcode.com/problems/single-number-ii/)。

考虑到如果一个数字出现了 n 次，那么该数字二进制的每一位都出现了 n 次，那么我们可以把所有数字每一个二进制上的 1 的个数相加，并对 3 取余，再把剩下二进制位为 1 的数转换成十进制数即可。如果把 3 次，改成 4、5 次，只需要把代码中 cnt 改成相应的数字即可。代码如下: 
```
class Solution {
public:
    int cnt = 3;
    int singleNumber(vector<int>& nums) {
        int res = 0;
        int digits[32] = {0};
        for (int i = 0; i < nums.size(); i++) {
            for (int j = 0; j < 32; j++) {
                digits[j] += (nums[i] >> j) & 1;
            }
        }
        for (int i = 0; i < 32; i++) {
            int d = digits[i] % cnt;
            res += d << i;
        }
        return res;
    }
};
```

上面的代码用一个数组来保存所有的二进制位，一种优化策略是用一个整数保存每一位出现的次数，然后循环检查 32 位。代码如下: 
```
class Solution {
public:
    int singleNumber(vector<int> &nums) {
        int res = 0;
        for (int i = 0; i < 32; i++) {
            int cnt = 0;
            for (int j = 0; j < nums.size(); j++) {
                cnt += (nums[j] >> i) & 1;
            }
            res |= (cnt % 3) << i;
        }
        return res;
    }
};
```

### 变形题 1 推广
[寻找单独数字的推广](https://leetcode.com/problems/single-number-ii/discuss/43295/Detailed-explanation-and-generalization-of-the-bitwise-operation-method-for-single-numbers)
 
Given an array of integers, every element appears k (k > 1) times except for one, which appears p times (p >= 1, p % k != 0). Find that single one. 

数组中，除了一个元素出现了 p 次，其他每个元素都出现了 k 次，求出现 p 次的数。 
 
用 x1, x2, x3...xm 分别表示二进制每一位上出现的次数，初始状态，xm = 0, ..., x1 = 0, 当遇到 1 时，x1 需要变成 1, 则 x1 = x1 | i, 在第二次遇到 i 中的 1 时，x1 需要置 0, 所以 x1 = x1 ^ i，此时 x2需要置 1，则 x2 = x2 ^ (x1 & i), 类似的 xm, xm - 1... 
 
当数字出现次数为 k 次时，二进制位标记的状态的十进制数也是 k，此时，需要把其他标记位清空。我们用mask来表示。如 k = 5 时，也就是二进制的 11. x1 = 1, x2 = 1, mask = ~(x1 & x2), 然后 x1, x2 分别 &mask, 最后返回 x1, 即是只出现一次的数。 

则本题的代码实现如下: 
```
class Solution {
public:
    int singleNumber(vector<int> &nums) {
        int x1 = 0, x2 = 0, mask = 0;
        for (int i = 0; i < nums.size(); i++) {
            x2 ^= (x1 & i);
            x1 ^= i;
            mask = ~(x1 & x2);
            x1 &= mask;
            x2 &= mask;
        }
        return x1;
    }
};
```
针对 k = 5 的情况，还有一种更简洁的方法。只用 a, b 两个变量来标记。第一次遇到数字 i, 用 a 存储，第二次遇到 i, 用 b 存储，第三次把 a, b 都清空。
具体代码实现如下: 
```
class Solution {
public:
    int singleNumber(vector<int>& nums) 
    {
        int a = 0, b = 0;
        for (int i = 0; i < nums.size(); ++i) 
        {
            b = (b ^ nums[i]) & ~a;
            a = (a ^ nums[i]) & ~b;
        } 
        return b;
    }
};
```

## 变形题 2 
如果只出现一次的数字有两个，其他数字都出现了两次，该如何找出那两个数字呢？ 
 
[Single Number III](https://leetcode.com/problems/single-number-iii/)
Given an array of numbers nums, in which exactly two elements appear only once and all the other elements appear exactly twice. Find the two elements that appear only once.

Example:
```
Input:  [1,2,1,3,2,5]
Output: [3,5]
```

我们可以借用只有一个数字的情况，把数组里的数字一分为二，每个子数组只包含一个单独数字。 
那么，要如何把他们分开呢？假设数组里有两个单独数字 a, b, a ^ b 会得到一个 c, 取 c 的二进制数中任意一个为 1 的位，作为 diff，然后用数组中的数分别与 diff 做异或，则可以把数组分开。代码实现如下: 
```
class Solution {
public:
    vector<int> singleNumber(vector<int>& nums) 
    {
        int diff = 0;
        for (auto n : nums) {
            diff ^= n;
        }
        diff &= -diff;
        vector<int> res = {0, 0};
        for (auto n : nums) {
            if (n & diff) {
                res[0] ^= n;
            }else {
                res[1] ^= n;
            }
        }
    }
};
```


参考资料
- [Detailed explanation and generalization of the bitwise operation method for single numbers](https://leetcode.com/problems/single-number-ii/discuss/43295/Detailed-explanation-and-generalization-of-the-bitwise-operation-method-for-single-numbers)
- [leetcode-137-Single Number II-第二种解法](https://cloud.tencent.com/developer/article/1131945)
- [Accepted C++/Java O(n)-time O(1)-space Easy Solution with Detail Explanations](https://leetcode.com/problems/single-number-iii/discuss/68900/Accepted-C%2B%2BJava-O(n)-time-O(1)-space-Easy-Solution-with-Detail-Explanations)