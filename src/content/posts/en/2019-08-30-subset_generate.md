---
title: 'Subset Generation'
pubDate: 2019-08-30
categories: [Algorithms]
tags:
    - Brute Force
    - LeetCode

toc: true
description: 'A guide to generating all subsets of a set (power set) using three methods: incremental construction, recursive backtracking, and bit manipulation, with C++ examples for LeetCode 78.'
---
## Overview
Many seemingly complex problems can be solved by "enumerating all possibilities" — brute-force enumeration. Though it may appear clumsy at first, it is often the most direct and reliable approach. In real-world development, BFS for shortest paths, backtracking for solutions, and combinatorial enumeration all rely on this idea.

This article focuses on a classic brute-force enumeration problem: generating all subsets of a given set (the `Power Set`). Other topics such as permutations and path searching will be covered in future articles.

## Problem Definition
Given an array `nums` with no duplicate elements, output all of its subsets — this is [LeetCode 78 - Subsets](https://leetcode.com/problems/subsets/). The answer size is `2^n`, and any algorithm needs at least linear time to output these results.

The following three commonly used methods cover most subset generation needs: **Incremental Construction**, **Recursive Backtracking (Bit Vector Method)**, **Bit Manipulation (Binary Enumeration)**. If the original array contains duplicate elements, you can deduplicate during generation, or sort first and skip identical values — hints will be given below.

### Method 1: Incremental Construction
Start with the empty set. For each element encountered, duplicate the current result set and append the element to each copy. The final number of sets doubles exactly.

Take `[1,2,3]` as an example:
- Initial result: `[]`
- Process `1`: append `1` to every existing subset, yielding `[]`, `[1]`
- Process `2`: append `2`, yielding `[]`, `[1]`, `[2]`, `[1,2]`
- Process `3`: similarly, get `[]`, `[1]`, `[2]`, `[1,2]`, `[3]`, `[1,3]`, `[2,3]`, `[1,2,3]`

Time complexity `O(n·2^n)`, space complexity `O(2^n)`.
```c++
vector<vector<int>> subsets(vector<int> &S) {
    vector<vector<int>> res(1);
    sort(S.begin(), S.end());
    for (int i = 0; i < S.size(); i++) {
        int size = res.size();
        for (int j = 0; j < size; j++) {
            res.push_back(res[j]);
            res.back().push_back(S[i]);
        }
    }
    return res;
}
```

> If the input contains duplicate elements, you can track the range of newly added subsets during each iteration and only append the same element to those new subsets, avoiding duplicate results.

The entire insertion order is:
```
[]
[1]
[2]
[1 2]
[3]
[1 3]
[2 3]
[1 2 3]
```

### Method 2: Recursive Backtracking (Bit Vector Method)
Each element has two states: "selected / not selected". This can be modeled as a binary decision tree: the left subtree represents choosing the current element, the right subtree represents not choosing it, and the leaf nodes are all the subsets. The state tree is shown below:
```
                        []
                   /          \
                  /            \
                 /              \
              [1]                []
           /       \           /    \
          /         \         /      \
       [1 2]       [1]       [2]     []
      /     \     /   \     /   \    / \
  [1 2 3] [1 2] [1 3] [1] [2 3] [2] [3] []
```
The code is as follows:
```c++
vector<vector<int>> subsets(vector<int> &S) {
    vector<vector<int>> res;
    vector<int> path;
    sort(S.begin(), S.end());
    genSubsets(S, 0, path, res);
    return res;
}
void genSubsets(vector<int> &S, int pos, vector<int> &path, vector<vector<int>> &res) {
    res.push_back(path);
    for (int i = pos; i < S.size(); i++) {
        if (i > pos && S[i] == S[i - 1]) continue; // skip duplicates if present
        path.push_back(S[i]);
        genSubsets(S, i + 1, path, res);
        path.pop_back();
    }
}
```

The entire insertion order is:
```
[]
[1]
[1 2]
[1 2 3]
[1 3]
[2]
[2 3]
[3]
```

### Method 3: Bit Manipulation Enumeration
Each element in a set has only two states: "selected / not selected", which maps directly to binary bits. By mapping a set of length `n` to binary numbers from `0` to `(1<<n)-1`, we can enumerate all subsets. The table below shows the mapping for `[1,2,3]`:

|       |   1   |    2    |    3    |   Subset  |
|-------|-------|---------|---------|-----------|
|   0   |   0   |    0    |    0    |[]         |
|   1   |   0   |    0    |    1    |[3]        |
|   2   |   0   |    1    |    0    |[2]        |
|   3   |   0   |    1    |    1    |[2,3]      |
|   4   |   1   |    0    |    0    |[1]        |
|   5   |   1   |    0    |    1    |[1,3]      |
|   6   |   1   |    1    |    0    |[1,2]      |
|   7   |   1   |    1    |    1    |[1,2,3]    |

The corresponding code is:
```c++
vector<vector<int>> subsets(vector<int> &S) {
    vector<vector<int>> res;
    sort(S.begin(), S.end());
    int total = 1 << S.size();
    for (int mask = 0; mask < total; mask++) {
        vector<int> subset;
        for (int i = 0; i < S.size(); i++) {
            if ((mask >> i) & 1) {
                subset.push_back(S[i]);
            }
        }
        res.push_back(move(subset));
    }
    return res;
}
```

## Summary
- All three methods have a time complexity of `O(n · 2^n)`, with differences primarily in implementation style and constant factors;
- Incremental construction is suitable for iterative implementation, backtracking is convenient for pruning or adding conditions, and bit manipulation is good for low-level performance optimization;
- When dealing with sets that contain duplicate elements, remember to sort first and skip duplicate values during generation;
- Can be extended to related problems: finding subsets of a fixed length, finding subsets that satisfy constraints (pruning early during backtracking), counting, and more.

Brute-force enumeration does not have to be crude. As long as you design the state representation and pruning strategy well, you can quickly find answers within the `2^n` search space.
