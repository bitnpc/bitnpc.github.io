---
layout: post
title: "二分搜索及其应用"
date: 2019-08-23
categories: [技术, 数据结构与算法]
tags: 
    - leetcode
    - 数据结构与算法
    - 二分搜索
mermaid: true
---

## 概述

二分搜索（`Binary Search`）又称折半搜索、对数搜索，适用于「答案在有序区间或单调空间内」的查找问题。核心思想是：每次选取区间中点与目标进行比较，将搜索空间缩小一半，最终在 `O(log n)` 时间内定位结果，额外空间复杂度 `O(1)`。

> **使用前提**：要使用二分，必须确保目标空间具有单调性（严格递增、非递减或可通过判定函数转化为单调布尔值）。LeetCode 提供了[二分专题练习](https://leetcode.com/tag/binary-search/)与[学习卡片](https://leetcode.com/explore/learn/card/binary-search)，适合作为系统训练素材。
{: .prompt-tip }

## 一、常用模板与技巧

典型的二分循环遵从以下模板：

```cpp
/**
 * 标准二分搜索模板
 * @param nums 有序数组
 * @param target 目标值
 * @return 目标值的索引，未找到返回 -1
 */
int binary_search(const vector<int>& nums, int target) {
    // 初始化搜索区间为闭区间 [left, right]
    int left = 0, right = static_cast<int>(nums.size()) - 1;
    
    // 当区间不为空时继续搜索
    while (left <= right) {
        // 计算中点，使用 (right - left) / 2 避免整型溢出
        int mid = left + (right - left) / 2;
        
        if (nums[mid] == target) {
            return mid;                      // 找到目标，直接返回
        } else if (nums[mid] < target) {
            left = mid + 1;                  // 目标在右半区，丢弃左半区
        } else {
            right = mid - 1;                 // 目标在左半区，丢弃右半区
        }
    }
    return -1;                               // 搜索区间为空，未找到
}
```

> **关键技巧**：
> - 使用 `left + (right - left) / 2` 避免 `left + right` 整型溢出
> - `while (left <= right)` 与 `left = mid + 1 / right = mid - 1` 搭配，适用于闭区间 `[left, right]`
> - 若使用半开区间 `[left, right)`，循环条件应为 `left < right`，且 `right = mid`
> - 明确循环结束时的语义：`left` 指向第一个大于目标的位置，可用于求上界、下界类问题
> - 二分不仅能在数组上查找，也能在答案空间上查找，只需自定义「判定函数 `check(mid)`」
{: .prompt-tip }

接下来结合典型题目展示常见应用场景。


## 二、基础例题：在有序数组中查找

最基础的二分问题来自 [LeetCode 704](https://leetcode.com/problems/binary-search/)。注意循环条件与边界的更新方式。

```cpp
/**
 * LeetCode 704: 二分搜索
 * 在有序数组中查找目标值
 */
int search(vector<int>& nums, int target) {
    int left = 0, right = static_cast<int>(nums.size()) - 1;
    
    while (left <= right) {
        int mid = left + (right - left) / 2;
        
        if (nums[mid] < target) {
            left = mid + 1;      // 目标在右半区
        } else if (nums[mid] > target) {
            right = mid - 1;    // 目标在左半区
        } else {
            return mid;          // 找到目标
        }
    }
    return -1;                  // 未找到
}
```

### 2.1 变形：查找边界

当数组包含重复元素时，常见需求是找到目标值的第一个或最后一个位置，例如 [LeetCode 34](https://leetcode.com/problems/find-first-and-last-position-of-element-in-sorted-array/)。

```cpp
/**
 * 查找目标值的第一个位置（lower_bound）
 * 使用半开区间 [left, right)，结束时 left 指向第一个 >= target 的位置
 */
int lower_bound(const vector<int>& nums, int target) {
    int left = 0, right = static_cast<int>(nums.size());
    
    // 使用半开区间，循环条件为 left < right
    while (left < right) {
        int mid = left + (right - left) / 2;
        
        if (nums[mid] < target) {
            left = mid + 1;      // 目标在右半区，mid 及左侧都不可能是答案
        } else {
            right = mid;         // mid 可能是答案，保留 mid
        }
    }
    
    // 检查 left 是否有效且等于 target
    return (left < nums.size() && nums[left] == target) ? left : -1;
}

/**
 * 查找目标值的最后一个位置（upper_bound）
 * 结束时 left 指向第一个 > target 的位置，所以最后一个位置是 left - 1
 */
int upper_bound(const vector<int>& nums, int target) {
    int left = 0, right = static_cast<int>(nums.size());
    
    while (left < right) {
        int mid = left + (right - left) / 2;
        
        if (nums[mid] <= target) {
            left = mid + 1;      // mid <= target，答案在右半区
        } else {
            right = mid;         // mid > target，mid 可能是第一个大于 target 的位置
        }
    }
    
    // left 指向第一个 > target 的位置，所以最后一个 target 的位置是 left - 1
    int idx = left - 1;
    return (idx >= 0 && nums[idx] == target) ? idx : -1;
}
```

> **边界查找技巧**：
> - `lower_bound`：查找第一个 `>= target` 的位置，可用于查找插入位置
> - `upper_bound`：查找第一个 `> target` 的位置，`upper_bound - 1` 是最后一个 `<= target` 的位置
> - 使用半开区间 `[left, right)` 时，循环结束时 `left == right`，指向目标位置
{: .prompt-info }

## 三、旋转数组问题

旋转数组是指将一个升序数组在某个枢轴位置断开并交换两段后得到的新数组，例如 `[0,1,2,4,5,6,7]` 旋转后可得到 `[4,5,6,7,0,1,2]`。此类数组依然保持两段分别有序，可用二分定位目标或最值。

> **旋转数组特性**：旋转后的数组分为两段，每段内部有序。通过比较 `nums[left]` 和 `nums[mid]` 可以判断哪一段是有序的，从而决定搜索方向。
{: .prompt-info }

### 3.1 旋转数组中查找目标

[LeetCode 33](https://leetcode.com/problems/search-in-rotated-sorted-array/) 假设不存在重复元素。关键在于每次比较 `nums[left]`、`nums[mid]` 判断哪一半有序，再决定舍弃哪一段。

```cpp
/**
 * LeetCode 33: 搜索旋转排序数组（无重复元素）
 * 核心思路：通过比较 nums[left] 和 nums[mid] 判断哪一半有序
 */
int search(vector<int>& nums, int target) {
    int left = 0, right = static_cast<int>(nums.size()) - 1;
    
    while (left <= right) {
        int mid = left + (right - left) / 2;
        
        if (nums[mid] == target) {
            return mid;
        }
        
        // 判断左半段 [left, mid] 是否有序
        if (nums[left] <= nums[mid]) {
            // 左半段有序，判断 target 是否在左半段范围内
            if (nums[left] <= target && target < nums[mid]) {
                right = mid - 1;    // target 在左半段，搜索左半段
            } else {
                left = mid + 1;     // target 在右半段，搜索右半段
            }
        } else {
            // 右半段 [mid, right] 有序，判断 target 是否在右半段范围内
            if (nums[mid] < target && target <= nums[right]) {
                left = mid + 1;     // target 在右半段，搜索右半段
            } else {
                right = mid - 1;    // target 在左半段，搜索左半段
            }
        }
    }
    return -1;
}
```
[LeetCode 81](https://leetcode.com/problems/search-in-rotated-sorted-array-ii/) 允许重复元素，此时当 `nums[left] == nums[mid]` 时无法判断哪侧有序，需要收缩左边界：

```cpp
/**
 * LeetCode 81: 搜索旋转排序数组 II（允许重复元素）
 * 当 nums[left] == nums[mid] 时，无法判断哪侧有序，需要线性收缩
 */
int searchWithDuplicate(vector<int>& nums, int target) {
    int left = 0, right = static_cast<int>(nums.size()) - 1;
    
    while (left <= right) {
        int mid = left + (right - left) / 2;
        
        if (nums[mid] == target) {
            return mid;
        }
        
        if (nums[left] < nums[mid]) {
            // 左侧严格递增，可以判断 target 是否在左半段
            if (nums[left] <= target && target < nums[mid]) {
                right = mid - 1;
            } else {
                left = mid + 1;
            }
        } else if (nums[left] > nums[mid]) {
            // 右侧递增，可以判断 target 是否在右半段
            if (nums[mid] < target && target <= nums[right]) {
                left = mid + 1;
            } else {
                right = mid - 1;
            }
        } else {
            // nums[left] == nums[mid]，无法判断哪侧有序
            // 例如 [3,1,3,3,3] 或 [3,3,3,1,3]
            // 只能线性收缩左边界，最坏时间复杂度退化为 O(n)
            left++;
        }
    }
    return -1;
}
```
### 3.2 查找最小元素

[LeetCode 153](https://leetcode.com/problems/find-minimum-in-rotated-sorted-array/) 要求在无重复的旋转数组中找到最小值。思路是二分判断区间是否有序，如果 `[left, right]` 已按升序排列，可直接返回 `nums[left]`。否则继续向无序半段收缩。

```cpp
/**
 * LeetCode 153: 寻找旋转排序数组中的最小值（无重复元素）
 * 核心思路：最小值一定在无序的那一半中
 */
int findMin(vector<int>& nums) {
    if (nums.empty()) return -1;
    
    int left = 0, right = static_cast<int>(nums.size()) - 1;
    
    while (left < right) {
        // 如果当前区间已经有序，最小值就是 nums[left]
        if (nums[left] < nums[right]) {
            return nums[left];
        }
        
        int mid = left + (right - left) / 2;
        
        // 判断哪一半无序，最小值在无序的那一半
        if (nums[left] <= nums[mid]) {
            // 左半段有序，最小值在右半段
            left = mid + 1;
        } else {
            // 右半段有序，最小值在左半段（包含 mid）
            right = mid;
        }
    }
    return nums[left];
}
```
若允许重复元素（[LeetCode 154](https://leetcode.com/problems/find-minimum-in-rotated-sorted-array-ii/)），在无法判断左右区间时需要线性收缩一端：

```cpp
/**
 * LeetCode 154: 寻找旋转排序数组中的最小值 II（允许重复元素）
 * 当 nums[left] == nums[mid] 时，无法判断最小值在哪一侧，需要线性收缩
 */
int findMin(vector<int>& nums) {
    if (nums.empty()) return -1;
    
    int left = 0, right = static_cast<int>(nums.size()) - 1;
    
    while (left < right) {
        if (nums[left] < nums[right]) {
            return nums[left];
        }
        
        int mid = left + (right - left) / 2;
        
        if (nums[left] < nums[mid]) {
            // 左半段有序，最小值在右半段
            left = mid + 1;
        } else if (nums[left] > nums[mid]) {
            // 右半段有序，最小值在左半段（包含 mid）
            right = mid;
        } else {
            // nums[left] == nums[mid]，无法判断，线性收缩
            // 例如 [3,3,1,3] 或 [3,1,3,3]
            left++;
        }
    }
    return nums[left];
}
```

## 四、多数组 / 多维场景

### 4.1 两个有序数组的中位数

[LeetCode 4](https://leetcode.com/problems/median-of-two-sorted-arrays/) 要在两个有序数组中找到中位数。朴素合并的复杂度是 `O(m+n)`，而使用二分可以在 `O(log(min(m,n)))` 时间内解决：通过二分划分短数组的位置，使得左右两侧元素个数满足中位数条件，具体推导可参考[讨论贴](https://leetcode.com/problems/median-of-two-sorted-arrays/discuss/2471/very-concise-ologminmn-iterative-solution-with-detailed-explanation)。

> **复杂度优化**：通过二分将时间复杂度从 `O(m+n)` 优化到 `O(log(min(m,n)))`，这是二分搜索在复杂问题中的典型应用。
{: .prompt-tip }

### 4.2 二维矩阵搜索

[LeetCode 74](https://leetcode.com/problems/search-a-2d-matrix/) 要在矩阵中查找目标，常见做法有两种：
- **方法一**：先在首列上二分定位行，再在行内二分（两次二分）
- **方法二**：把矩阵当作一维数组，利用索引映射 `row = mid / n`、`col = mid % n` 完成一次二分

**方法一：两次二分搜索**

```cpp
/**
 * LeetCode 74: 搜索二维矩阵（方法一：两次二分）
 * 先定位行，再在行内搜索
 */
bool searchMatrix(vector<vector<int>>& matrix, int target) {
    if (matrix.empty() || matrix[0].empty()) return false;
    
    // 快速判断：如果 target 不在矩阵范围内，直接返回 false
    if (target < matrix[0][0] || matrix.back().back() < target) {
        return false;
    }
    
    // 第一步：在首列中二分查找，找到 target 可能所在的行
    int left = 0, right = matrix.size() - 1;
    while (left <= right) {
        int mid = left + (right - left) / 2;
        if (matrix[mid][0] < target) {
            left = mid + 1;
        } else if (matrix[mid][0] > target) {
            right = mid - 1;
        } else {
            return true;  // 首列元素等于 target
        }
    }
    
    // right 指向最后一个首列元素小于 target 的行
    int row = right;
    if (row < 0) return false;
    
    // 第二步：在找到的行内二分查找
    left = 0;
    right = matrix[row].size() - 1;
    while (left <= right) {
        int mid = left + (right - left) / 2;
        if (matrix[row][mid] < target) {
            left = mid + 1;
        } else if (matrix[row][mid] > target) {
            right = mid - 1;
        } else {
            return true;
        }
    }
    return false;
}
```

**方法二：一次二分搜索（推荐）**

```cpp
/**
 * LeetCode 74: 搜索二维矩阵（方法二：一次二分）
 * 将二维矩阵视为一维数组，通过索引映射完成二分
 */
bool searchMatrix(vector<vector<int>>& matrix, int target) {
    if (matrix.empty() || matrix[0].empty()) return false;
    
    // 快速判断
    if (target < matrix[0][0] || matrix.back().back() < target) {
        return false;
    }
    
    int m = matrix.size(), n = matrix[0].size();
    int left = 0, right = m * n - 1;  // 将矩阵视为长度为 m*n 的一维数组
    
    while (left <= right) {
        int mid = left + (right - left) / 2;
        
        // 将一维索引 mid 映射到二维坐标 (row, col)
        int row = mid / n;      // 行索引
        int col = mid % n;      // 列索引
        int num = matrix[row][col];
        
        if (num == target) {
            return true;
        } else if (num < target) {
            left = mid + 1;
        } else {
            right = mid - 1;
        }
    }
    return false;
}
```

> **索引映射技巧**：对于 `m × n` 的矩阵，一维索引 `i` 对应的二维坐标为 `(i / n, i % n)`。这种方法可以将二维问题转化为一维问题，简化实现。
{: .prompt-tip }

## 五、树结构中的二分思想

二分不只作用于数组，凡是能快速缩小范围的数据结构都可借鉴同样的思路。二叉搜索树（BST）按中序遍历是有序序列，因此可用类似二分的思想定位元素。

### 5.1 二叉搜索树中查找第 k 小元素

[LeetCode 230](https://leetcode.com/problems/kth-smallest-element-in-a-bst/) 要求找到第 `k` 小的节点，可通过节点计数或栈模拟中序遍历实现：

**方法一：递归 + 节点计数**

```cpp
/**
 * LeetCode 230: 二叉搜索树中第K小的元素（递归方法）
 * 利用 BST 的性质：左子树 < 根 < 右子树
 */
int kthSmallest(TreeNode* root, int k) {
    // 计算左子树的节点数
    int count = countNodes(root->left);
    
    if (k <= count) {
        // 第 k 小在左子树中
        return kthSmallest(root->left, k);
    } else if (k > count + 1) {
        // 第 k 小在右子树中，需要减去左子树和根节点的数量
        return kthSmallest(root->right, k - count - 1);
    } else {
        // k == count + 1，当前根节点就是第 k 小
        return root->val;
    }
}

/**
 * 计算以 node 为根的子树节点数
 */
int countNodes(TreeNode *node) {
    if (!node) return 0;
    return 1 + countNodes(node->left) + countNodes(node->right);
}
```

**方法二：迭代 + 中序遍历**

```cpp
/**
 * LeetCode 230: 二叉搜索树中第K小的元素（迭代方法）
 * 使用栈模拟中序遍历，找到第 k 个节点
 */
int kthSmallest(TreeNode* root, int k) {
    stack<TreeNode *> s;
    TreeNode *p = root;
    int cnt = 0;
    
    // 中序遍历：左 -> 根 -> 右
    while (!s.empty() || p) {
        // 一直向左走到最左节点
        while (p) {
            s.push(p);
            p = p->left;
        }
        
        // 访问当前节点（中序遍历的根节点）
        p = s.top();
        s.pop();
        cnt++;
        
        // 如果访问到第 k 个节点，返回其值
        if (cnt == k) {
            return p->val;
        }
        
        // 转向右子树
        p = p->right;
    }
    return -1;
}
```

### 5.2 完全二叉树插入新节点

[LeetCode 919](https://leetcode.com/problems/complete-binary-tree-inserter/)（Google 校招面试题）：给出一个完全二叉树，要求插入一个新节点后仍然为完全二叉树。

**方法一：BFS 查找插入位置**

```cpp
/**
 * 方法一：使用 BFS 找到第一个缺少子节点的节点
 * 时间复杂度 O(n)，空间复杂度 O(n)
 */
void insert(TreeNode *root, TreeNode *newNode) {
    if (!root) return;
    
    queue<TreeNode*> q;
    q.push(root);
    
    while (!q.empty()) {
        TreeNode* node = q.front();
        q.pop();
        
        // 优先插入左子节点
        if (!node->left) {
            node->left = newNode;
            break;
        }
        // 左子节点已满，插入右子节点
        if (!node->right) {
            node->right = newNode;
            break;
        }
        
        // 当前节点已满，继续遍历
        q.push(node->left);
        q.push(node->right);
    }
}
```

**方法二：节点计数 + 二进制路径（推荐）**

```cpp
/**
 * 方法二：利用完全二叉树的性质 + 二进制路径定位
 * 时间复杂度 O(log n)，空间复杂度 O(1)
 * 
 * 核心思想：
 * 1. 完全二叉树按层序编号，新节点的编号为 count + 1
 * 2. 新节点的父节点编号为 (count + 1) / 2
 * 3. 通过二进制表示路径：0 表示左，1 表示右
 */
class CBTInserter {
public:
    explicit CBTInserter(TreeNode* r) : root(r), count(countNodes(r)) {}

    /**
     * 插入新节点
     * @param val 新节点的值
     * @return 父节点的值
     */
    int insert(int val) {
        ++count;  // 新节点的编号
        
        // 找到新节点的父节点（编号为 count / 2）
        TreeNode* parent = locateParent(count / 2);
        
        // 创建新节点
        TreeNode* node = new TreeNode(val);
        
        // 根据编号的奇偶性决定插入左子树还是右子树
        // 偶数编号 -> 左子树，奇数编号 -> 右子树
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
    int count;  // 当前节点总数

    /**
     * 计算以 node 为根的子树节点数
     */
    int countNodes(TreeNode* node) {
        if (!node) return 0;
        return 1 + countNodes(node->left) + countNodes(node->right);
    }

    /**
     * 根据层序编号定位节点
     * @param idx 节点的层序编号（从 1 开始）
     * @return 对应的节点
     * 
     * 算法：将 idx 转换为二进制，从高位到低位表示从根到目标节点的路径
     * 例如：idx = 6 (二进制 110) -> 根 -> 右 -> 左
     */
    TreeNode* locateParent(int idx) {
        // 将 idx 转换为二进制路径（从低位到高位）
        vector<int> path;
        while (idx > 1) {
            path.push_back(idx % 2);  // 0 表示左，1 表示右
            idx /= 2;
        }
        
        // 从根节点开始，按照路径向下遍历
        TreeNode* cur = root;
        for (int i = static_cast<int>(path.size()) - 1; i >= 0; --i) {
            cur = (path[i] == 0) ? cur->left : cur->right;
        }
        return cur;
    }
};
```

> **完全二叉树性质**：完全二叉树的节点按层序编号，编号为 `i` 的节点的左子节点编号为 `2i`，右子节点编号为 `2i+1`，父节点编号为 `⌊i/2⌋`。利用这个性质可以通过二进制路径快速定位节点。
{: .prompt-info }

## 六、答案空间二分

当结果无法直接定位，但可以通过「给定答案是否可行」来判断时，就可以在答案空间上套用二分。这类问题的关键是设计一个判定函数 `check(mid)`，判断答案 `mid` 是否满足条件。

> **答案空间二分**：不是直接在数组中搜索，而是在可能的答案范围内搜索。需要设计判定函数来判断某个答案是否可行，然后根据判定结果缩小搜索范围。
{: .prompt-tip }

### 6.1 LeetCode 69：`Sqrt(x)`

```cpp
/**
 * LeetCode 69: x 的平方根
 * 在答案空间 [1, x/2] 中二分查找
 * 判定函数：mid * mid <= x
 */
int mySqrt(int x) {
    if (x < 2) return x;  // 0 和 1 的平方根是自身
    
    // 答案空间：[1, x/2]
    // 因为 sqrt(x) <= x/2 (当 x >= 4 时)
    int left = 1, right = x / 2, ans = 1;
    
    while (left <= right) {
        int mid = left + (right - left) / 2;
        long long square = 1LL * mid * mid;  // 防止溢出
        
        if (square == x) {
            return mid;           // 找到精确值
        } else if (square < x) {
            ans = mid;            // 记录当前最大的满足条件的值
            left = mid + 1;       // 尝试更大的值
        } else {
            right = mid - 1;      // 平方太大，缩小上界
        }
    }
    return ans;  // 返回最大的满足 mid*mid <= x 的值
}
```

### 6.2 Google：分蛋糕问题

**题意**：`n` 个人分享若干圆形蛋糕，每个蛋糕半径已知，可切分为多个扇形，问每人能获得的最大面积。

**思路**：在答案空间 `[0, max(蛋糕面积)]` 中二分查找。判定函数 `check(mid)`：计算所有蛋糕能切出的份数是否不少于 `n`。

```cpp
/**
 * 判定函数：判断每人分得 mid 面积时，是否能满足 n 个人
 * @param areas 所有蛋糕的面积
 * @param mid 每人分得的面积
 * @param n 人数
 * @return 是否能满足 n 个人
 */
bool check(const vector<double>& areas, double mid, int n) {
    int cnt = 0;
    for (double a : areas) {
        // 每个蛋糕能切出的份数 = 蛋糕面积 / 每份面积
        cnt += static_cast<int>(a / mid);
        // 如果已经能满足 n 个人，提前返回
        if (cnt >= n) return true;
    }
    return false;
}

/**
 * 分蛋糕问题：求每人能获得的最大面积
 * @param radii 每个蛋糕的半径
 * @param n 人数
 * @return 每人能获得的最大面积
 */
double maximumAreaServingCake(const vector<int>& radii, int n) {
    const double PI = acos(-1.0);
    vector<double> areas(radii.size());
    double hi = 0.0;
    
    // 计算每个蛋糕的面积，并找到最大面积作为上界
    for (size_t i = 0; i < radii.size(); ++i) {
        areas[i] = PI * radii[i] * radii[i];
        hi = max(hi, areas[i]);
    }
    
    // 答案空间：[0, max(蛋糕面积)]
    double lo = 0.0;
    
    // 浮点数二分：迭代固定次数达到足够精度
    // 60 次迭代可以达到约 1e-18 的精度
    for (int iter = 0; iter < 60; ++iter) {
        double mid = (lo + hi) / 2.0;
        
        // 如果 mid 满足条件，说明答案可能更大，提高下界
        // 否则答案更小，降低上界
        if (mid > 0 && check(areas, mid, n)) {
            lo = mid;
        } else {
            hi = mid;
        }
    }
    return lo;  // 返回满足条件的最大面积
}
```

> **浮点数二分技巧**：对于浮点数答案空间，通常使用固定迭代次数而不是 `while (left < right)`，因为浮点数比较可能陷入死循环。60 次迭代通常足以达到所需精度。
{: .prompt-info }

## 七、总结

二分搜索是一种高效且应用广泛的算法，掌握其核心思想和常见变体对于解决各类问题都很有帮助。

### 关键要点

1. **使用前提**：判断问题是否具备单调性，是选择二分的前提
2. **区间处理**：根据区间类型（闭区间 `[left, right]` / 半开区间 `[left, right)`）调整循环条件与边界更新
3. **结构适配**：对于旋转数组、二维矩阵、树等结构，需要结合结构特性决定如何分半
4. **答案空间二分**：在答案空间上二分时，关键是设计正确的判定函数 `check(mid)`
5. **实践建议**：整理出模板、注意溢出与死循环、通过练习巩固边界思维