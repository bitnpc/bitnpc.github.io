---
layout: post
title: "子集生成"
date: 2019-08-30
categories: [技术, 数据结构与算法]
tags:
    - leetcode
    - 算法
    - 暴力求解
---
很多问题都可以“**暴力解决**”。不需要动太多脑筋，把所有的可能性都列出来，然后一一实验。这样的方法显得很“笨”，却往往是行之有效的。 并且，很多问题拆分后的子问题，也需要用暴力求解的思想，比如 `BFS` 搜索最短路径，就需要列出所有可能，然后加入队列。 

本篇讨论暴力求解的其中一个问题，子集生成问题。其他暴力求解的问题，如简单枚举，枚举排列，回溯法，路径寻找（隐式图的遍历）等问题，本篇暂不讨论。

## 子集生成问题
给定一个集合，枚举出所有可能的子集。[leetcode 第 78 题](https://leetcode.com/problems/subsets/)

所有的自己生成问题都可以用三种方法来解决。**增量构造法**，**位向量法**，和**二进制法**。

### 增量构造法
思路是每次选出一个元素放入集合中。 

比如对于题目中给的例子 `[1,2,3]` 来说，最开始是空集，那么我们现在要处理 `1`，就在空集上加 `1`，为 `[1]`，现在我们有两个自己 `[]` 和 `[1]`，下面我们来处理 `2`，我们在之前的子集基础上，每个都加个 `2`，可以分别得到 `[2]`，`[1, 2]`，那么现在所有的子集合为 `[]`, `[1]`, `[2]`, `[1, 2]`，同理处理 `3` 的情况可得 `[3]`, `[1, 3]`, `[2, 3]`, `[1, 2, 3]`, 再加上之前的子集就是所有的子集合了，代码如下：
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
整个添加的顺序为：
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

### 位向量法
由于原集合每一个数字只有两种状态，要么存在，要么不存在，那么在构造子集时就有选择和不选择两种情况，所以可以构造一棵二叉树，左子树表示选择该层处理的节点，右子树表示不选择，最终的叶节点就是所有子集合，树的结构如下: 
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
代码如下：
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
        path.push_back(S[i]);
        genSubsets(S, i + 1, path, res);
        path.pop_back();
    }
}
```

整个添加的顺序为: 
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

### 二进制法
由于集合中每个元素只有两种可能，选 与 不选。正好对应二进制的 `1` 和 `0`。于是，很自然的想到用二进制数字来表示集合的选择情况。 

下面是二进制数字和对应的集合。

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

对应的代码如下：
```c++
vector<vector<int>> subsets(vector<int> &S) {
    vector<vector<int>> res;
    sort(S.being(), S.end());
    int max = 1 << S.size();
    for (int k = 0; k < max; k++) {
        vector<int> out = genSubset(S, k);
        res.push_back(out);
    }
    return res;
}

vector<int> genSubset(vector<int> &S, int k) {
    vector<int> sub;
    int idx = 0;
    for (int i = k; i > 0; i = i >> 1) {
        if ((i & 1) == 1) {
            sub.push_back(S[idx]);
        }
        idx++;
    }
    return sub;
}
```