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
## 二分搜索简介
在计算机科学中，二分搜索（`binary search`）也称折半搜索（`half-interval search`）、对数搜索（`logarithmic search`），是在有序数组中查找某一特定元素的搜索算法。 

其基本思想是通过逐次比较数组特定范围的中间元素与目标元素的大小，每次缩小一半的搜索范围，来提高搜索效率。 

二分搜索的时间复杂度是 `O(log n)`，空间复杂度为 `O(1)`。 

[这里](https://leetcode.com/tag/binary-search/)是 leetcode 中和二分搜索有关的习题。
leetcode 上有个二分查找的[专题练习卡片](https://leetcode.com/explore/learn/card/binary-search)


## 例题一
最简单情形的二分搜索。注意循环的判定条件，和 start end 赋值更新逻辑。
[leetcode 第 704 题](https://leetcode.com/problems/binary-search/)

```cpp
int search(vector<int>& nums, int target) {
    int res = -1;
    int start = 0, end = nums.size() - 1;
    int mid = 0;
    while (start <= end) {
        mid = start + (end - start) / 2;
        if (nums[mid] < target) {
            start = mid + 1;
        }else if (nums[mid] > target) {
            end = mid - 1;
        }else {
            res = mid;
            break;
        }
    }
    return res;
}
```
### 变形
如果数组中有重复数字，找到该数字的起始和终止位置。 
[leetcode 第 34 题](https://leetcode.com/problems/find-first-and-last-position-of-element-in-sorted-array/)
```cpp
// 起始位置
int lower_bound(vector<int>& nums, int target) {
    int res = -1;
    int start = 0, end = nums.size() - 1;
    int mid = 0;
    while (start <= end) {
        mid = start + (end - start) / 2;
        if (nums[mid] < target) {
            start = mid + 1;
        }else if (nums[mid] > target) {
            end = mid - 1;
        }else {
            res = mid;
            end = mid - 1;
        }
    }
    return res;
}
// 终止位置
int upper_bound(vector<int>& nums, int target) {
    int res = -1;
    int start = 0, end = nums.size() - 1;
    int mid = 0;
    while (start <= end) {
        mid = start + (end - start) / 2;
        if (nums[mid] < target) {
            start = mid + 1;
        }else if (nums[mid] > target) {
            end = mid - 1;
        }else {
            res = mid;
            start = mid + 1;
        }
    }
    return res;
}
```

## 旋转数组问题
旋转数组：顾名思义，一个有序的数组，从某个位置分成两部分，然后把这两部分颠倒顺序后形成的新数组。

`(i.e., [0,1,2,4,5,6,7] might become [4,5,6,7,0,1,2]).`

### 旋转数组的搜索
假设没有重复元素，使用二分搜索，难点在于左右边界的限定。注意小于等于号的位置。
[leetcode 第 33 题](https://leetcode.com/problems/search-in-rotated-sorted-array/)
```cpp
int search(vector<int>& nums. int target) {
    int res = -1;
    int start = 0, end = nums.size() - 1;
    int mid = 0;
    while (start <= end) {
        mid = start + (end - start) / 2;
        if (nums[mid] == target) {
            res = mid;
            break;
        }
        if (nums[start] <= nums[mid]) {
            if (nums[start] <= target && target < nums[mid]) {
                end = mid - 1;
            }else {
                start = mid + 1;
            }
        }else {
            if (nums[mid] < target && target <= nums[end]) {
                start = mid + 1;
            }else {
                end = mid - 1;
            }
        }
    }
    return res;
}
```
如果有重复元素的话，该如何修改呢？
[leetcode 第 81 题](https://leetcode.com/problems/search-in-rotated-sorted-array-ii/)
上一题如果 `nums[start] <= nums[mid]`, 那么 `[start, mid]` 为递增序列的假设不成立，比如 `[1, 3, 1, 1, 1]`。
如果 `nums[start] <= nums[mid]` 不能确定递增，那么就把它拆分为两个条件：
1. 如果 `nums[start] < nums[mid]`，那么区间 `[start, mid]` 必然递增
2. 如果 `nums[start] == nums[mid]`，那么 `start++`，往下看一步即可
```cpp
int search(vector<int>& nums. int target) {
    int res = -1;
    int start = 0, end = nums.size() - 1;
    int mid = 0;
    while (start <= end) {
        mid = start + (end - start) / 2;
        if (nums[mid] == target) {
            res = mid;
            break;
        }
        if (nums[start] < nums[mid]) {
            if (nums[start] <= target && target < nums[mid]) {
                end = mid - 1;
            }else {
                start = mid + 1;
            }
        }else if (nums[start] > nums[mid]) {
            if (nums[mid] < target && target <= nums[end]) {
                start = mid + 1;
            }else {
                end = mid - 1;
            }
        }else {
            start++;
        }
    }
    return res;
}
```
假设没有重复元素，搜索最小值、最大值。
[leetcode 第 153 题](https://leetcode.com/problems/find-minimum-in-rotated-sorted-array/)
以下是搜索最小值的算法，搜索最大值同理，只需要改下返回值和 `start`, `end` 的赋值逻辑。
```cpp
int findMin(vector<int>& nums) {
    if (nums.size() == 0) return -1;
    if (nums.size() == 1) return nums[0];
    int start = 0, end = nums.size() - 1; 
    while (start < end) {
        if (nums[start] < nums[end]) {
            return nums[start];
        }
        int mid = start + (end - start) / 2;
        if (nums[start] <= nums[mid]) {
            start = mid + 1;
        }else {
            end = mid;
        }
    }
    return nums[start];        
}    
```
如果有相同元素该怎么办呢？和查找元素类似，在相等的时候做特殊处理。
[leetcode 第 154 题](https://leetcode.com/problems/find-minimum-in-rotated-sorted-array-ii/)
```cpp
int findMin(vector<int>& nums) {
    if (nums.size() == 0) return -1;
    if (nums.size() == 1) return nums[0];
    int start = 0, end = nums.size() - 1; 
    while (start < end) {
        if (nums[start] < nums[end]) {
            return nums[start];
        }
        int mid = start + (end - start) / 2;
        if (nums[start] < nums[mid]) {
            start = mid + 1;
        }else if (nums[start] > nums[mid]){
            end = mid;
        }else {
            start++;
        }
    }
    return nums[start];            
}        
```

## 多个数组查找
查找两个有序数组的中位数。
[leetcode 第 4 题](https://leetcode.com/problems/median-of-two-sorted-arrays/)
这道题很难，不仅思路很难理清楚，corner case 也需要考虑。 
当然，可以选择把两个数组合并成一个，然后使用二分查找。时间复杂度是 `O(m + n)`, 空间复杂度是 `O(m + n)`，但这显然不是最优解。
解法见[这里](https://leetcode.com/problems/median-of-two-sorted-arrays/discuss/2471/very-concise-ologminmn-iterative-solution-with-detailed-explanation)


## 二维数组搜索
上面的题目都是一维的数组，那么如何在二维数组中使用二分搜索呢？
[leetcode 第 74 题](https://leetcode.com/problems/search-a-2d-matrix/)
可以用两次二分搜索，先找到行数，再找到列数。
也可以直接用一次二分搜索，但是需要把二维坐标和一维坐标做转换。
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
一次二分搜索。一维数组中的 `i` 对应二维数组中的行号是 `i / n`, 列号是 `i % n`。
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

## 树的搜索
最常见的就是 `BST` 了。`BST` 按照中序遍历即是一个有序数组。
[leetcode 第 230 题](https://leetcode.com/problems/kth-smallest-element-in-a-bst/)
由于遍历二叉树有递归和迭代两种方法，所以这道题也有对应的两种解法。
```cpp
int kthSmallest(TreeNode* root, int k) {
    int count = countNodes(root->left);
    if (k <= count) {
        return kthSmallest(root->left, k);
    }else if (k > count + 1) {
        return kthSmallest(root->left, k - count - 1);
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
    queue<TreeNode *> q;
    q.push(root);
    while (!q.empty()) {
        TreeNode *node = q.top();
        q.pop();
        if (!node->left) {
            node->left = newNode;
            break;
        }
        if (!node->right) {
            node->right = newNode;
            break;
        }
        if (node->left) {
            q.push(node->left);
        }
        if (node->right) {
            q.push(node->right);
        }
    }
}
``` 

也可以用二分搜索，每次判断当前节点的左右儿子的最大深度，记为 `dl`, `dr`, 如果 `dl > dr`, 则向左子树再次执行该操作，否则向右子树再次执行该操作。直到找到没有左儿子或者右儿子的节点。
```cpp
int depth(TreeNode *node) {
    int d = 0;
    while (node) {
        d++;
        node = node->right;
    }
    return d;
}
void insert(TreeNode *root, TreeNode *node) {
    TreeNode *root = this->root;
    int dl = depth(root->left), dr = depth(root->right);
    TreeNode *node = new TreeNode(v);
    while (root) {
        if (!root->left) {
            root->left = node;
            break;
        }
        if (!root->right) {
            root->right = node;
            break;
        }
        if (dl == dr) {
            root = root->left;
            dr = dl - 1;
            dl = depth(root->left);
        }else {
            root = root->right;
            dl = depth(root->left);
            dr = dr - 1;
        }
    }
}
```
还有另一种思路，可以借助当前树的总节点个数来实现 `O(log n)` 复杂度的插入。
详情见[这里](https://leetcode.com/problems/complete-binary-tree-inserter/discuss/186830/Java-O(1)-space-O(n)-init-O(logN)-insert)

## 其他数学问题
如求解 Sqrt(x)。[leetcode 第 69 题](https://leetcode.com/problems/sqrtx/) 
```cpp
int mySqrt(int x) {
    if (x < 2) return x;
    int start = 0, end = x, mid = 0;
    int res = 1;
    while (start <= end) {
        mid = start + (end - start) / 2;
        if (x / mid == mid) {
            res = mid;
            break;
        }else if (x / mid < mid) {
            end = mid - 1;
        }else {
            start = mid + 1;
            res = mid;
        }
    }
    return res;
}
```
下面来看一道 Google 面试题。
[分蛋糕问题](https://leetcode.com/discuss/interview-question/348510/Google-or-Online-Assessment-or-Maximum-Area-Serving-Cake)
大致意思是，`n` 个人平分 `m` 个蛋糕，问每个人分得的最大面积是多少（一个蛋糕可以分给多个人，多个蛋糕不能分给同一个人）
二分法求满足人数的最大面积。

```cpp
bool possible(vector<int> &areas, int x, int n) {
    bool res = false;
    int k = 0;
    for (auto a : areas) {
        k += a / x;
        if (k >= n) {
            res = true;
            break;
        }
    }
    return res;
}
int maximumAreaServingCake(vector<int> radii, int n) {
    vector<int> areas(radii.size());
    int maxArea = 0;
    for (int i = 0; i < radii.size(); i++) {
        int r = radii[i];
        areas[i] = M_PI * r * r;
        maxArea = max(maxArea, areas[i]);
    }
    int l = 0, r = maxArea;
    int x = 0;
    while (r - l <= 1e-5) {
        x = l + (r - l) / 2;
        if (possible(x)) {
            l = x;
        }else {
            r = x;
        }
    }
    return round(x * 10000) / 10000;
}
```

可以看到，二分搜索的应用领域很广，应用场景也很多样。在不同的数据结构中，二分搜索都有用武之地。


