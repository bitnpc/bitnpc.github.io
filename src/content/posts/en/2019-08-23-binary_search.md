---
title: 'Binary Search and Its Applications'
pubDate: 2019-08-23
categories: [Tech, Data Structures and Algorithms]
tags: 
    - leetcode
    - data structures and algorithms
    - binary search
toc: true
description: 'Binary Search, also known as half-interval search or logarithmic search, is applicable to searching problems where "the answer lies within an ordered interval or monotonic space." The core idea is to compare the midpoint of the interval with the target, halving the search space with each step, ultimately locating the result in O(log n) time with O(1) extra space.'
translationKey: 'binary_search'
---

## Overview

Binary Search (`Binary Search`), also known as half-interval search or logarithmic search, is applicable to searching problems where "the answer lies within an ordered interval or monotonic space." The core idea is to compare the midpoint of the interval with the target, halving the search space with each step, ultimately locating the result in `O(log n)` time with `O(1)` extra space.
```alert
type: success
description: **Prerequisites**: To use binary search, the target space must exhibit monotonicity (strictly increasing, non-decreasing, or reducible to a monotonic boolean via a decision function). LeetCode offers a [binary search topic collection](https://leetcode.com/tag/binary-search/) and a [study card](https://leetcode.com/explore/learn/card/binary-search) that serve as great systematic training resources.
```

## 1. Common Templates and Techniques

A typical binary search loop follows this template:

```cpp
/**
 * Standard Binary Search Template
 * @param nums sorted array
 * @param target target value
 * @return index of the target value, or -1 if not found
 */
int binary_search(const vector<int>& nums, int target) {
    // Initialize the search interval as a closed interval [left, right]
    int left = 0, right = static_cast<int>(nums.size()) - 1;

    // Continue searching while the interval is non-empty
    while (left <= right) {
        // Calculate midpoint using (right - left) / 2 to avoid integer overflow
        int mid = left + (right - left) / 2;

        if (nums[mid] == target) {
            return mid;                      // Target found, return directly
        } else if (nums[mid] < target) {
            left = mid + 1;                  // Target is in the right half, discard left half
        } else {
            right = mid - 1;                 // Target is in the left half, discard right half
        }
    }
    return -1;                               // Search interval is empty, not found
}
```
```alert
type: success
description: **Key Techniques**:
- Use `left + (right - left) / 2` to avoid integer overflow from `left + right`
- `while (left <= right)` paired with `left = mid + 1 / right = mid - 1` works for closed intervals `[left, right]`
- For half-open intervals `[left, right)`, the loop condition should be `left < right` with `right = mid`
- Understand the semantics when the loop ends: `left` points to the first position greater than the target, useful for upper/lower bound problems
- Binary search works not only on arrays but also on answer spaces — simply define a custom `check(mid)` decision function
```

Next, we'll walk through typical problems to illustrate common application scenarios.


## 2. Basic Example: Searching in a Sorted Array

The most fundamental binary search problem comes from [LeetCode 704](https://leetcode.com/problems/binary-search/). Pay attention to the loop condition and boundary update logic.

```cpp
/**
 * LeetCode 704: Binary Search
 * Search for a target value in a sorted array
 */
int search(vector<int>& nums, int target) {
    int left = 0, right = static_cast<int>(nums.size()) - 1;

    while (left <= right) {
        int mid = left + (right - left) / 2;

        if (nums[mid] < target) {
            left = mid + 1;      // Target is in the right half
        } else if (nums[mid] > target) {
            right = mid - 1;    // Target is in the left half
        } else {
            return mid;          // Target found
        }
    }
    return -1;                  // Not found
}
```

### 2.1 Variant: Finding Boundaries

When the array contains duplicate elements, a common requirement is to find the first or last occurrence of a target value, as seen in [LeetCode 34](https://leetcode.com/problems/find-first-and-last-position-of-element-in-sorted-array/).

```cpp
/**
 * Find the first occurrence of a target value (lower_bound)
 * Uses half-open interval [left, right); when the loop ends, left points to the first position >= target
 */
int lower_bound(const vector<int>& nums, int target) {
    int left = 0, right = static_cast<int>(nums.size());

    // Uses half-open interval, loop condition is left < right
    while (left < right) {
        int mid = left + (right - left) / 2;

        if (nums[mid] < target) {
            left = mid + 1;      // Target is in the right half; mid and everything left of it cannot be the answer
        } else {
            right = mid;         // mid could be the answer, keep mid
        }
    }

    // Check if left is valid and equals target
    return (left < nums.size() && nums[left] == target) ? left : -1;
}

/**
 * Find the last occurrence of a target value (upper_bound)
 * When the loop ends, left points to the first position > target, so the last position is left - 1
 */
int upper_bound(const vector<int>& nums, int target) {
    int left = 0, right = static_cast<int>(nums.size());

    while (left < right) {
        int mid = left + (right - left) / 2;

        if (nums[mid] <= target) {
            left = mid + 1;      // mid <= target, answer is in the right half
        } else {
            right = mid;         // mid > target, mid might be the first position > target
        }
    }

    // left points to the first position > target, so the last target position is left - 1
    int idx = left - 1;
    return (idx >= 0 && nums[idx] == target) ? idx : -1;
}
```
```alert
type: info
description: **Boundary Search Techniques**:
- `lower_bound`: finds the first position `>= target`, useful for finding insertion positions
- `upper_bound`: finds the first position `> target`; `upper_bound - 1` is the last position `<= target`
- When using the half-open interval `[left, right)`, `left == right` at loop termination, pointing to the target position
```

## 3. Rotated Array Problems

A rotated array is formed by taking a sorted array, breaking it at some pivot point, and swapping the two segments. For example, `[0,1,2,4,5,6,7]` rotated might become `[4,5,6,7,0,1,2]`. Such arrays maintain order within each of the two segments, so binary search can be used to locate a target or find the extremum.
```alert
type: info
description: **Rotated Array Property**: A rotated array consists of two segments, each internally sorted. By comparing `nums[left]` and `nums[mid]`, you can determine which segment is sorted, and thus decide the search direction.
```

### 3.1 Searching for a Target in a Rotated Array

[LeetCode 33](https://leetcode.com/problems/search-in-rotated-sorted-array/) assumes no duplicate elements. The key is to compare `nums[left]`, `nums[mid]` to determine which half is sorted, then decide which segment to discard.

```cpp
/**
 * LeetCode 33: Search in Rotated Sorted Array (no duplicates)
 * Core idea: determine which half is sorted by comparing nums[left] and nums[mid]
 */
int search(vector<int>& nums, int target) {
    int left = 0, right = static_cast<int>(nums.size()) - 1;

    while (left <= right) {
        int mid = left + (right - left) / 2;

        if (nums[mid] == target) {
            return mid;
        }

        // Check if the left half [left, mid] is sorted
        if (nums[left] <= nums[mid]) {
            // Left half is sorted, check if target is within the left half's range
            if (nums[left] <= target && target < nums[mid]) {
                right = mid - 1;    // Target is in the left half, search left half
            } else {
                left = mid + 1;     // Target is in the right half, search right half
            }
        } else {
            // Right half [mid, right] is sorted, check if target is within the right half's range
            if (nums[mid] < target && target <= nums[right]) {
                left = mid + 1;     // Target is in the right half, search right half
            } else {
                right = mid - 1;    // Target is in the left half, search left half
            }
        }
    }
    return -1;
}
```
[LeetCode 81](https://leetcode.com/problems/search-in-rotated-sorted-array-ii/) allows duplicate elements. When `nums[left] == nums[mid]`, it's impossible to determine which side is sorted, so we need to shrink the left boundary:

```cpp
/**
 * LeetCode 81: Search in Rotated Sorted Array II (with duplicates)
 * When nums[left] == nums[mid], it's impossible to determine which side is sorted; need to shrink linearly
 */
int searchWithDuplicate(vector<int>& nums, int target) {
    int left = 0, right = static_cast<int>(nums.size()) - 1;

    while (left <= right) {
        int mid = left + (right - left) / 2;

        if (nums[mid] == target) {
            return mid;
        }

        if (nums[left] < nums[mid]) {
            // Left side is strictly increasing, can determine if target is in the left half
            if (nums[left] <= target && target < nums[mid]) {
                right = mid - 1;
            } else {
                left = mid + 1;
            }
        } else if (nums[left] > nums[mid]) {
            // Right side is increasing, can determine if target is in the right half
            if (nums[mid] < target && target <= nums[right]) {
                left = mid + 1;
            } else {
                right = mid - 1;
            }
        } else {
            // nums[left] == nums[mid], cannot determine which side is sorted
            // e.g. [3,1,3,3,3] or [3,3,3,1,3]
            // Can only shrink the left boundary linearly; worst-case time complexity degrades to O(n)
            left++;
        }
    }
    return -1;
}
```
### 3.2 Finding the Minimum Element

[LeetCode 153](https://leetcode.com/problems/find-minimum-in-rotated-sorted-array/) requires finding the minimum value in a rotated array without duplicates. The idea is to check whether the interval is sorted via binary search; if `[left, right]` is already in ascending order, return `nums[left]` directly. Otherwise, continue narrowing down to the unsorted half.

```cpp
/**
 * LeetCode 153: Find Minimum in Rotated Sorted Array (no duplicates)
 * Core idea: the minimum element always lies in the unsorted half
 */
int findMin(vector<int>& nums) {
    if (nums.empty()) return -1;

    int left = 0, right = static_cast<int>(nums.size()) - 1;

    while (left < right) {
        // If the current interval is already sorted, nums[left] is the minimum
        if (nums[left] < nums[right]) {
            return nums[left];
        }

        int mid = left + (right - left) / 2;

        // Determine which half is unsorted; the minimum is in the unsorted half
        if (nums[left] <= nums[mid]) {
            // Left half is sorted, minimum is in the right half
            left = mid + 1;
        } else {
            // Right half is sorted, minimum is in the left half (including mid)
            right = mid;
        }
    }
    return nums[left];
}
```
If duplicates are allowed ([LeetCode 154](https://leetcode.com/problems/find-minimum-in-rotated-sorted-array-ii/)), when it's impossible to determine which side to search, one end must be shrunk linearly:

```cpp
/**
 * LeetCode 154: Find Minimum in Rotated Sorted Array II (with duplicates)
 * When nums[left] == nums[mid], cannot determine which side holds the minimum; need to shrink linearly
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
            // Left half is sorted, minimum is in the right half
            left = mid + 1;
        } else if (nums[left] > nums[mid]) {
            // Right half is sorted, minimum is in the left half (including mid)
            right = mid;
        } else {
            // nums[left] == nums[mid], cannot determine, shrink linearly
            // e.g. [3,3,1,3] or [3,1,3,3]
            left++;
        }
    }
    return nums[left];
}
```

## 4. Multi-Array / Multi-Dimensional Scenarios

### 4.1 Median of Two Sorted Arrays

[LeetCode 4](https://leetcode.com/problems/median-of-two-sorted-arrays/) requires finding the median of two sorted arrays. The naive merge approach has a complexity of `O(m+n)`, while binary search can solve it in `O(log(min(m,n)))` time: by binary searching over the shorter array's partition position such that the element counts on both sides satisfy the median condition. For a detailed derivation, see this [discussion thread](https://leetcode.com/problems/median-of-two-sorted-arrays/discuss/2471/very-concise-ologminmn-iterative-solution-with-detailed-explanation).
```alert
type: success
description: **Complexity Optimization**: Binary search reduces the time complexity from `O(m+n)` to `O(log(min(m,n)))`, a classic application of binary search in complex problems.
```

### 4.2 2D Matrix Search

[LeetCode 74](https://leetcode.com/problems/search-a-2d-matrix/) requires searching for a target in a matrix. Two common approaches exist:
- **Method 1**: Binary search on the first column to locate the row, then binary search within that row (two binary searches)
- **Method 2**: Treat the matrix as a 1D array, using index mapping `row = mid / n`, `col = mid % n` for a single binary search

**Method 1: Two Binary Searches**

```cpp
/**
 * LeetCode 74: Search a 2D Matrix (Method 1: Two Binary Searches)
 * First locate the row, then search within that row
 */
bool searchMatrix(vector<vector<int>>& matrix, int target) {
    if (matrix.empty() || matrix[0].empty()) return false;

    // Quick check: if target is outside the matrix range, return false immediately
    if (target < matrix[0][0] || matrix.back().back() < target) {
        return false;
    }

    // Step 1: Binary search on the first column to find the possible row for target
    int left = 0, right = matrix.size() - 1;
    while (left <= right) {
        int mid = left + (right - left) / 2;
        if (matrix[mid][0] < target) {
            left = mid + 1;
        } else if (matrix[mid][0] > target) {
            right = mid - 1;
        } else {
            return true;  // First column element equals target
        }
    }

    // right points to the last row whose first element is less than target
    int row = right;
    if (row < 0) return false;

    // Step 2: Binary search within the identified row
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

**Method 2: Single Binary Search (Recommended)**

```cpp
/**
 * LeetCode 74: Search a 2D Matrix (Method 2: Single Binary Search)
 * Treat the 2D matrix as a 1D array and perform binary search using index mapping
 */
bool searchMatrix(vector<vector<int>>& matrix, int target) {
    if (matrix.empty() || matrix[0].empty()) return false;

    // Quick check
    if (target < matrix[0][0] || matrix.back().back() < target) {
        return false;
    }

    int m = matrix.size(), n = matrix[0].size();
    int left = 0, right = m * n - 1;  // Treat the matrix as a 1D array of length m*n

    while (left <= right) {
        int mid = left + (right - left) / 2;

        // Map 1D index mid to 2D coordinates (row, col)
        int row = mid / n;      // row index
        int col = mid % n;      // column index
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
```alert
type: success
description: **Index Mapping Technique**: For an `m x n` matrix, the 2D coordinates corresponding to 1D index `i` are `(i / n, i % n)`. This approach reduces a 2D problem to a 1D problem, simplifying implementation.
```

## 5. Binary Search Thinking in Trees

Binary search is not limited to arrays — any data structure that allows fast range reduction can benefit from the same idea. A Binary Search Tree (BST) produces an ordered sequence when traversed in-order, so similar binary search principles apply for locating elements.

### 5.1 Finding the k-th Smallest Element in a BST

[LeetCode 230](https://leetcode.com/problems/kth-smallest-element-in-a-bst/) requires finding the `k`-th smallest node. This can be solved via node counting or using a stack to simulate in-order traversal:

**Method 1: Recursion + Node Counting**

```cpp
/**
 * LeetCode 230: Kth Smallest Element in a BST (Recursive Method)
 * Leverages BST property: left subtree < root < right subtree
 */
int kthSmallest(TreeNode* root, int k) {
    // Count the number of nodes in the left subtree
    int count = countNodes(root->left);

    if (k <= count) {
        // The k-th smallest is in the left subtree
        return kthSmallest(root->left, k);
    } else if (k > count + 1) {
        // The k-th smallest is in the right subtree; subtract left subtree and root count
        return kthSmallest(root->right, k - count - 1);
    } else {
        // k == count + 1, the current root is the k-th smallest
        return root->val;
    }
}

/**
 * Count the number of nodes in the subtree rooted at node
 */
int countNodes(TreeNode *node) {
    if (!node) return 0;
    return 1 + countNodes(node->left) + countNodes(node->right);
}
```

**Method 2: Iteration + In-order Traversal**

```cpp
/**
 * LeetCode 230: Kth Smallest Element in a BST (Iterative Method)
 * Use a stack to simulate in-order traversal, visiting the k-th node
 */
int kthSmallest(TreeNode* root, int k) {
    stack<TreeNode *> s;
    TreeNode *p = root;
    int cnt = 0;

    // In-order traversal: left -> root -> right
    while (!s.empty() || p) {
        // Keep going left to the leftmost node
        while (p) {
            s.push(p);
            p = p->left;
        }

        // Visit the current node (the root of in-order traversal)
        p = s.top();
        s.pop();
        cnt++;

        // If we've visited the k-th node, return its value
        if (cnt == k) {
            return p->val;
        }

        // Move to the right subtree
        p = p->right;
    }
    return -1;
}
```

### 5.2 Inserting into a Complete Binary Tree

[LeetCode 919](https://leetcode.com/problems/complete-binary-tree-inserter/) (Google Campus Interview Question): Given a complete binary tree, insert a new node while keeping it complete.

**Method 1: BFS to Find Insertion Position**

```cpp
/**
 * Method 1: Use BFS to find the first node missing a child
 * Time complexity O(n), space complexity O(n)
 */
void insert(TreeNode *root, TreeNode *newNode) {
    if (!root) return;

    queue<TreeNode*> q;
    q.push(root);

    while (!q.empty()) {
        TreeNode* node = q.front();
        q.pop();

        // Prefer inserting as left child
        if (!node->left) {
            node->left = newNode;
            break;
        }
        // Left child is occupied, insert as right child
        if (!node->right) {
            node->right = newNode;
            break;
        }

        // Current node is full, continue traversal
        q.push(node->left);
        q.push(node->right);
    }
}
```

**Method 2: Node Counting + Binary Path (Recommended)**

```cpp
/**
 * Method 2: Leverage the properties of a complete binary tree + binary path positioning
 * Time complexity O(log n), space complexity O(1)
 *
 * Core idea:
 * 1. Complete binary tree nodes are numbered level by level; the new node's number is count + 1
 * 2. The parent of the new node is numbered (count + 1) / 2
 * 3. Use binary representation for the path: 0 for left, 1 for right
 */
class CBTInserter {
public:
    explicit CBTInserter(TreeNode* r) : root(r), count(countNodes(r)) {}

    /**
     * Insert a new node
     * @param val value of the new node
     * @return value of the parent node
     */
    int insert(int val) {
        ++count;  // Number of the new node

        // Find the parent of the new node (numbered count / 2)
        TreeNode* parent = locateParent(count / 2);

        // Create the new node
        TreeNode* node = new TreeNode(val);

        // Determine left or right child based on parity of the number
        // Even number -> left child, odd number -> right child
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
    int count;  // Total number of nodes

    /**
     * Count the number of nodes in the subtree rooted at node
     */
    int countNodes(TreeNode* node) {
        if (!node) return 0;
        return 1 + countNodes(node->left) + countNodes(node->right);
    }

    /**
     * Locate a node by its level-order number
     * @param idx level-order number of the node (starting from 1)
     * @return the corresponding node
     *
     * Algorithm: Convert idx to binary; from high to low bits represents the path from root to target
     * Example: idx = 6 (binary 110) -> root -> right -> left
     */
    TreeNode* locateParent(int idx) {
        // Convert idx to binary path (from low to high bits)
        vector<int> path;
        while (idx > 1) {
            path.push_back(idx % 2);  // 0 means left, 1 means right
            idx /= 2;
        }

        // Start from the root and traverse down the path
        TreeNode* cur = root;
        for (int i = static_cast<int>(path.size()) - 1; i >= 0; --i) {
            cur = (path[i] == 0) ? cur->left : cur->right;
        }
        return cur;
    }
};
```
```alert
type: info
description: **Complete Binary Tree Properties**: In a complete binary tree, nodes are numbered level by level. The left child of node `i` is numbered `2i`, the right child is `2i+1`, and the parent is numbered `⌊i/2⌋`. This property enables fast node location using binary path traversal.
```

## 6. Binary Search on Answer Space

When a result cannot be directly determined, but you can check whether a candidate answer is feasible, binary search can be applied over the answer space. The key is to design a decision function `check(mid)` that determines whether the answer `mid` satisfies the conditions.
```alert
type: success
description: **Answer Space Binary Search**: Instead of searching directly in an array, search within the range of possible answers. You need to design a decision function that determines whether a candidate answer is feasible, then narrow the search range based on the result.
```

### 6.1 LeetCode 69: `Sqrt(x)`

```cpp
/**
 * LeetCode 69: Sqrt(x)
 * Binary search over the answer space [1, x/2]
 * Decision function: mid * mid <= x
 */
int mySqrt(int x) {
    if (x < 2) return x;  // Square root of 0 and 1 is themselves

    // Answer space: [1, x/2]
    // Because sqrt(x) <= x/2 (when x >= 4)
    int left = 1, right = x / 2, ans = 1;

    while (left <= right) {
        int mid = left + (right - left) / 2;
        long long square = 1LL * mid * mid;  // Prevent overflow

        if (square == x) {
            return mid;           // Exact value found
        } else if (square < x) {
            ans = mid;            // Record the largest value satisfying the condition so far
            left = mid + 1;       // Try a larger value
        } else {
            right = mid - 1;      // Square is too large, shrink upper bound
        }
    }
    return ans;  // Return the largest value where mid*mid <= x
}
```

### 6.2 Google: Cake Sharing Problem

**Problem**: `n` people share several circular cakes, each with a known radius. Cakes can be cut into multiple sectors. Find the maximum area each person can receive.

**Approach**: Binary search over the answer space `[0, max(cake area)]`. Decision function `check(mid)`: calculate whether the total number of pieces from all cakes is at least `n`.

```cpp
/**
 * Decision function: determines whether giving mid area per person can satisfy n people
 * @param areas areas of all cakes
 * @param mid area per person
 * @param n number of people
 * @return whether n people can be satisfied
 */
bool check(const vector<double>& areas, double mid, int n) {
    int cnt = 0;
    for (double a : areas) {
        // Number of pieces from each cake = cake area / piece area
        cnt += static_cast<int>(a / mid);
        // If enough pieces for n people, return early
        if (cnt >= n) return true;
    }
    return false;
}

/**
 * Cake sharing problem: find the maximum area each person can receive
 * @param radii radius of each cake
 * @param n number of people
 * @return maximum area each person can receive
 */
double maximumAreaServingCake(const vector<int>& radii, int n) {
    const double PI = acos(-1.0);
    vector<double> areas(radii.size());
    double hi = 0.0;

    // Calculate each cake's area and find the maximum as the upper bound
    for (size_t i = 0; i < radii.size(); ++i) {
        areas[i] = PI * radii[i] * radii[i];
        hi = max(hi, areas[i]);
    }

    // Answer space: [0, max(cake area)]
    double lo = 0.0;

    // Floating-point binary search: iterate a fixed number of times for sufficient precision
    // 60 iterations achieve approximately 1e-18 precision
    for (int iter = 0; iter < 60; ++iter) {
        double mid = (lo + hi) / 2.0;

        // If mid satisfies the condition, the answer might be larger, raise the lower bound
        // Otherwise, the answer is smaller, lower the upper bound
        if (mid > 0 && check(areas, mid, n)) {
            lo = mid;
        } else {
            hi = mid;
        }
    }
    return lo;  // Return the maximum feasible area
}
```
```alert
type: info
description: **Floating-Point Binary Search Tips**: For floating-point answer spaces, use a fixed number of iterations instead of `while (left < right)`, since floating-point comparisons can lead to infinite loops. 60 iterations are typically sufficient for the required precision.
```

## 7. Summary

Binary search is a highly efficient and widely applicable algorithm. Mastering its core ideas and common variants is invaluable for solving a diverse range of problems.

### Key Takeaways

1. **Prerequisites**: Determine whether the problem exhibits monotonicity — this is the precondition for choosing binary search
2. **Interval Handling**: Adjust the loop condition and boundary updates based on the interval type (closed interval `[left, right]` / half-open interval `[left, right)`)
3. **Structural Adaptation**: For structures like rotated arrays, 2D matrices, and trees, combine the structural characteristics to decide how to partition
4. **Answer Space Binary Search**: When binary searching over the answer space, the key is to design a correct decision function `check(mid)`
5. **Practice Suggestions**: Organize templates, watch for overflow and infinite loops, and reinforce boundary thinking through practice
