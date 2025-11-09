---
layout: post
title: "二分搜索及其应用"
date: 2019-08-23
categories: [技术, 数据结构与算法]
tags: 
    - leetcode
    - 数据结构与算法
    - 二分搜索
---
## 概述
二分搜索（`Binary Search`）又称折半搜索、对数搜索，适用于「答案在有序区间或单调空间内」的查找问题。核心思想是：每次选取区间中点与目标进行比较，将搜索空间缩小一半，最终在 `O(log n)` 时间内定位结果，额外空间复杂度 `O(1)`。

要使用二分，必须确保目标空间具有单调性（严格递增、非递减或可通过判定函数转化为单调布尔值）。LeetCode 提供了[二分专题练习](https://leetcode.com/tag/binary-search/)与[学习卡片](https://leetcode.com/explore/learn/card/binary-search)，适合作为系统训练素材。

## 常用模板与技巧

典型的二分循环遵从以下模板：

```cpp
int binary_search(const vector<int>& nums, int target) {
    int left = 0, right = static_cast<int>(nums.size()) - 1;
    while (left <= right) {
        int mid = left + (right - left) / 2; // 防溢出
        if (nums[mid] == target) {
            return mid;                      // 命中
        } else if (nums[mid] < target) {
            left = mid + 1;                  // 丢弃左半区
        } else {
            right = mid - 1;                 // 丢弃右半区
        }
    }
    return -1;                               // 未找到
}
```

> 小贴士：
> - 使用 `left + (right - left) / 2` 避免 `left + right` 整型溢出；
> - `while (left <= right)` 与 `left = mid + 1 / right = mid - 1` 搭配；若使用半开区间 `[left, right)`，循环条件应为 `left < right`；
> - 明确循环结束时的语义，例如 `left` 指向第一个大于目标的位置，可用于求上界，下界类问题；
> - 二分不仅能在数组上查找，也能在答案空间上查找，只需自定义「判定函数 `check(mid)`」。

接下来结合典型题目展示常见应用场景。


## 基础例题：在有序数组中查找
最基础的二分问题来自 [LeetCode 704](https://leetcode.com/problems/binary-search/)。注意循环条件与边界的更新方式。

```cpp
int search(vector<int>& nums, int target) {
    int left = 0, right = static_cast<int>(nums.size()) - 1;
    while (left <= right) {
        int mid = left + (right - left) / 2;
        if (nums[mid] < target) {
            left = mid + 1;
        } else if (nums[mid] > target) {
            right = mid - 1;
        } else {
            return mid;
        }
    }
    return -1;
}
```

### 变形：查找边界
当数组包含重复元素时，常见需求是找到目标值的第一个或最后一个位置，例如 [LeetCode 34](https://leetcode.com/problems/find-first-and-last-position-of-element-in-sorted-array/)。
```cpp
// 起始位置（lower_bound）
int lower_bound(const vector<int>& nums, int target) {
    int left = 0, right = static_cast<int>(nums.size());
    while (left < right) {
        int mid = left + (right - left) / 2;
        if (nums[mid] < target) {
            left = mid + 1;
        } else {
            right = mid;
        }
    }
    return (left < nums.size() && nums[left] == target) ? left : -1;
}

// 终止位置（upper_bound）
int upper_bound(const vector<int>& nums, int target) {
    int left = 0, right = static_cast<int>(nums.size());
    while (left < right) {
        int mid = left + (right - left) / 2;
        if (nums[mid] <= target) {
            left = mid + 1;
        } else {
            right = mid;
        }
    }
    int idx = left - 1;
    return (idx >= 0 && nums[idx] == target) ? idx : -1;
}
```

## 旋转数组问题
旋转数组是指将一个升序数组在某个枢轴位置断开并交换两段后得到的新数组，例如 `[0,1,2,4,5,6,7]` 旋转后可得到 `[4,5,6,7,0,1,2]`。此类数组依然保持两段分别有序，可用二分定位目标或最值。

### 旋转数组中查找目标
[LeetCode 33](https://leetcode.com/problems/search-in-rotated-sorted-array/) 假设不存在重复元素。关键在于每次比较 `nums[left]`、`nums[mid]` 判断哪一半有序，再决定舍弃哪一段。
```cpp
int search(vector<int>& nums, int target) {
    int left = 0, right = static_cast<int>(nums.size()) - 1;
    while (left <= right) {
        int mid = left + (right - left) / 2;
        if (nums[mid] == target) {
            return mid;
        }
        // 左半段有序
        if (nums[left] <= nums[mid]) {
            if (nums[left] <= target && target < nums[mid]) {
                right = mid - 1;
            } else {
                left = mid + 1;
            }
        } else { // 右半段有序
            if (nums[mid] < target && target <= nums[right]) {
                left = mid + 1;
            } else {
                right = mid - 1;
            }
        }
    }
    return -1;
}
```
[LeetCode 81](https://leetcode.com/problems/search-in-rotated-sorted-array-ii/) 允许重复元素，此时当 `nums[left] == nums[mid]` 时无法判断哪侧有序，需要收缩左边界：
```cpp
int searchWithDuplicate(vector<int>& nums, int target) {
    int left = 0, right = static_cast<int>(nums.size()) - 1;
    while (left <= right) {
        int mid = left + (right - left) / 2;
        if (nums[mid] == target) {
            return mid;
        }
        if (nums[left] < nums[mid]) { // 左侧严格递增
            if (nums[left] <= target && target < nums[mid]) {
                right = mid - 1;
            } else {
                left = mid + 1;
            }
        } else if (nums[left] > nums[mid]) { // 右侧递增
            if (nums[mid] < target && target <= nums[right]) {
                left = mid + 1;
            } else {
                right = mid - 1;
            }
        } else { // nums[left] == nums[mid]，无法判断，跳过一个
            left++;
        }
    }
    return -1;
}
```
### 查找最小元素
[LeetCode 153](https://leetcode.com/problems/find-minimum-in-rotated-sorted-array/) 要求在无重复的旋转数组中找到最小值。思路是二分判断区间是否有序，如果 `[left, right]` 已按升序排列，可直接返回 `nums[left]`。否则继续向无序半段收缩。
```cpp
int findMin(vector<int>& nums) {
    if (nums.empty()) return -1;
    int left = 0, right = static_cast<int>(nums.size()) - 1;
    while (left < right) {
        if (nums[left] < nums[right]) {
            return nums[left];
        }
        int mid = left + (right - left) / 2;
        if (nums[left] <= nums[mid]) {
            left = mid + 1;
        } else {
            right = mid;
        }
    }
    return nums[left];
}
```
若允许重复元素（[LeetCode 154](https://leetcode.com/problems/find-minimum-in-rotated-sorted-array-ii/)），在无法判断左右区间时需要线性收缩一端：
```cpp
int findMin(vector<int>& nums) {
    if (nums.empty()) return -1;
    int left = 0, right = static_cast<int>(nums.size()) - 1;
    while (left < right) {
        if (nums[left] < nums[right]) {
            return nums[left];
        }
        int mid = left + (right - left) / 2;
        if (nums[left] < nums[mid]) {
            left = mid + 1;
        } else if (nums[left] > nums[mid]) {
            right = mid;
        } else {
            left++;
        }
    }
    return nums[left];
}
```

## 多数组 / 多维场景

### 两个有序数组的中位数
[LeetCode 4](https://leetcode.com/problems/median-of-two-sorted-arrays/) 要在两个有序数组中找到中位数。朴素合并的复杂度是 `O(m+n)`，而使用二分可以在 `O(log(min(m,n)))` 时间内解决：通过二分划分短数组的位置，使得左右两侧元素个数满足中位数条件，具体推导可参考[讨论贴](https://leetcode.com/problems/median-of-two-sorted-arrays/discuss/2471/very-concise-ologminmn-iterative-solution-with-detailed-explanation)。

### 二维矩阵搜索
[LeetCode 74](https://leetcode.com/problems/search-a-2d-matrix/) 要在矩阵中查找目标，常见做法有两种：
- 先在首列上二分定位行，再在行内二分；
- 把矩阵当作一维数组，利用索引映射 `row = mid / n`、`col = mid % n` 完成一次二分。
```cpp
bool searchMatrix(vector<vector<int>>& matrix, int target) {
    if (matrix.empty() || matrix[0].empty()) return false;
    if (target < matrix[0][0] || matrix.back().back() < target) return false;
    int left = 0, right = matrix.size() - 1;
    int mid = 0;
    while (left <= right) {
        mid = left + (right - left) / 2;
        if (matrix[mid][0] < target) {
            left = mid + 1;
        }else if (matrix[mid][0] > target) {
            right = mid - 1;
        }else {
            return true;
        }
    }
    int row = right;
    left = 0, right = matrix[row].size() - 1;
    while (left <= right) {
        mid = left + (right - left) / 2;
        if (matrix[row][mid] < target) {
            left = mid + 1;
        }else if (matrix[row][mid] > target) {
            right = mid - 1;
        }else {
            return true;
        }
    }
    return false;
}
```
一次二分搜索。一维数组下标 `i` 映射至行列分别为 `i / n` 与 `i % n`：
```cpp
bool searchMatrix(vector<vector<int>>& matrix, int target) {
    if (matrix.empty() || matrix[0].empty()) return false;
    if (target < matrix[0][0] || matrix.back().back() < target) return false;
    int m = matrix.size(), n = matrix[0].size();
    int left = 0, right = m * n - 1;
    int mid = 0;
    while (left <= right) {
        mid = left + (right - left) / 2;
        int num = matrix[mid / n][mid % n];
        if (num == target) {
            return true;
        }else if (num < target) {
            left = mid + 1;
        }else {
            right = mid - 1;
        }
    }
    return false;
}
```

## 树结构中的二分思想
二分不只作用于数组，凡是能快速缩小范围的数据结构都可借鉴同样的思路。二叉搜索树（BST）按中序遍历是有序序列，因此可用类似二分的思想定位元素。[LeetCode 230](https://leetcode.com/problems/kth-smallest-element-in-a-bst/) 要求找到第 `k` 小的节点，可通过节点计数或栈模拟中序遍历实现：
```cpp
int kthSmallest(TreeNode* root, int k) {
    int count = countNodes(root->left);
    if (k <= count) {
        return kthSmallest(root->left, k);
    } else if (k > count + 1) {
        return kthSmallest(root->right, k - count - 1);
    }
    return root->val;
}
int countNodes(TreeNode *node) {
    if (!node) return 0;
    return 1 + countNodes(node->left) + countNodes(node->right);
}
```
```cpp
int kthSmallest(TreeNode* root, int k) {
    int res = -1;
    stack<TreeNode *> s;
    TreeNode *p = root;
    int cnt = 0;
    while (!s.empty() || p) {
        while (p) {
            s.push(p);
            p = p->left;
        }
        p = s.top();
        s.pop();
        cnt++;
        if (cnt == k) {
            res = p->val;
            break;
        }
        p = p->right;
    }
    return res;
}
```

完全二叉树插入新节点问题。（ Google 校招面试题 ）
[leetcode 第 919 题](https://leetcode.com/problems/complete-binary-tree-inserter/submissions/)
给出一个完全二叉树，要求插入一个新节点后仍然为完全二叉树。
可以用 `BFS`, 当遇到第一个没有左儿子或右儿子的节点时，插入到对应的位置。时间复杂度 `O(n)`，空间复杂度 `O(n)`。
```cpp
void insert(TreeNode *root, TreeNode *newNode) {
    if (!root) return;
    queue<TreeNode*> q;
    q.push(root);
    while (!q.empty()) {
        TreeNode* node = q.front();
        q.pop();
        if (!node->left) {
            node->left = newNode;
            break;
        }
        if (!node->right) {
            node->right = newNode;
            break;
        }
        q.push(node->left);
        q.push(node->right);
    }
}
``` 

另一种方法是利用节点计数 + 二进制路径，达到 `O(log n)` 插入。[官方题解](https://leetcode.com/problems/complete-binary-tree-inserter/discuss/186830/Java-O(1)-space-O(n)-init-O(logN)-insert) 中的核心思路如下：

```cpp
class CBTInserter {
public:
    explicit CBTInserter(TreeNode* r) : root(r), count(countNodes(r)) {}

    int insert(int val) {
        ++count;
        TreeNode* parent = locateParent(count / 2);
        TreeNode* node = new TreeNode(val);
        if (count % 2 == 0) {
            parent->left = node;
        } else {
            parent->right = node;
        }
        return parent->val;
    }

    TreeNode* get_root() { return root; }

private:
    TreeNode* root;
    int count;

    int countNodes(TreeNode* node) {
        if (!node) return 0;
        return 1 + countNodes(node->left) + countNodes(node->right);
    }

    TreeNode* locateParent(int idx) {
        // idx 对应完全二叉树层序编号，借助二进制从根节点向下遍历
        vector<int> path;
        while (idx > 1) {
            path.push_back(idx % 2);
            idx /= 2;
        }
        TreeNode* cur = root;
        for (int i = static_cast<int>(path.size()) - 1; i >= 0; --i) {
            cur = (path[i] == 0) ? cur->left : cur->right;
        }
        return cur;
    }
};
```

## 答案空间二分
当结果无法直接定位，但可以通过「给定答案是否可行」来判断时，就可以在答案空间上套用二分。

### LeetCode 69：`Sqrt(x)`
```cpp
int mySqrt(int x) {
    if (x < 2) return x;
    int left = 1, right = x / 2, ans = 1;
    while (left <= right) {
        int mid = left + (right - left) / 2;
        long long square = 1LL * mid * mid;
        if (square == x) {
            return mid;
        } else if (square < x) {
            ans = mid;
            left = mid + 1;
        } else {
            right = mid - 1;
        }
    }
    return ans;
}
```

### Google：分蛋糕问题
题意：`n` 个人分享若干圆形蛋糕，每个蛋糕半径已知，可切分为多个扇形，问每人能获得的最大面积。判断函数 `check(mid)`：计算所有蛋糕能切出的份数是否不少于 `n`。

```cpp
bool check(const vector<double>& areas, double mid, int n) {
    int cnt = 0;
    for (double a : areas) {
        cnt += static_cast<int>(a / mid);
        if (cnt >= n) return true;
    }
    return false;
}

double maximumAreaServingCake(const vector<int>& radii, int n) {
    const double PI = acos(-1.0);
    vector<double> areas(radii.size());
    double hi = 0.0;
    for (size_t i = 0; i < radii.size(); ++i) {
        areas[i] = PI * radii[i] * radii[i];
        hi = max(hi, areas[i]);
    }
    double lo = 0.0;
    for (int iter = 0; iter < 60; ++iter) { // 二分到足够精度
        double mid = (lo + hi) / 2.0;
        if (mid > 0 && check(areas, mid, n)) {
            lo = mid;
        } else {
            hi = mid;
        }
    }
    return lo;
}
```

## 总结
- 判断问题是否具备单调性，是选择二分的前提；
- 根据区间类型（闭区间 / 半开区间）调整循环条件与边界更新；
- 对于旋转数组、二维矩阵、树等结构，需要结合结构特性决定如何分半；
- 在答案空间上二分时，关键是设计正确的判定函数 `check(mid)`；
- 实战中建议整理出模板、注意溢出与死循环、通过练习巩固边界思维。

二分搜索的应用领域非常广泛，从基础数组到复杂数据结构乃至工程问题，都能见到它的身影。
