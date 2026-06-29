---
title: 'An Algorithmic Synthesis Problem: Path With Minimum Effort'
pubDate: 2023-10-25
categories: [Tech, Data Structures & Algorithms]
tags:
    - leetcode
    - Data Structures & Algorithms
    - DFS
    - BFS
    - UnionFind
    - Dijkstra
    - Binary Search
toc: true
description: 'A walkthrough of LeetCode 1631 (minimax path) using binary search + BFS/DFS, union-find (Kruskal), and adapted Dijkstra.'
---

## Problem Description

> [LeetCode 1631. Path With Minimum Effort](https://leetcode.com/problems/path-with-minimum-effort/)

You are a hiker preparing for an upcoming hike. You are given heights, a 2D array of size rows x columns, where heights[row][col] represents the height of cell (row, col). You are situated in the top-left cell, (0, 0), and you hope to travel to the bottom-right cell, (rows-1, columns-1) (i.e., 0-indexed). You can move up, down, left, or right, and you wish to find a route that requires the minimum effort.

A route's effort is the maximum absolute difference in heights between two consecutive cells of the route.

Return the minimum effort required to travel from the top-left cell to the bottom-right cell.

- Example 1:

![ex1](../../../assets/images/posts/post-2023-10-25/ex1.png)

```
Input: heights = [[1,2,2],[3,8,2],[5,3,5]]
Output: 2
Explanation: The route of [1,3,5,3,5] has a maximum absolute difference of 2 in consecutive cells.
This is better than the route of [1,2,2,2,5], where the maximum absolute difference is 3.
```

## Approach

What makes this problem such an excellent synthesis exercise is that it can be solved using **at least four different algorithmic paradigms**, each offering a distinct perspective:

| Method | Core Idea | Time Complexity |
|--------|-----------|-----------------|
| Binary Search + BFS/DFS | Convert optimization to decision problem | O(mn · log(maxHeight)) |
| Union-Find (Kruskal) | Model as a minimum bottleneck path | O(mn · log(mn)) |
| Dijkstra | Adapt shortest path with max relaxation | O(mn · log(mn)) |

**Key insight**: This problem does not ask for the minimum *sum* of edge weights along a path (classic shortest path), but rather the minimum possible *maximum single edge weight* along a path. This "minimax path" problem is known in graph theory as the **Minimum Bottleneck Path**.

---

## Method 1: Binary Search + BFS/DFS

### Intuition

Transform the optimization problem into a decision problem:

- **Decision problem**: Given a threshold `threshold`, does there exist a path from the top-left to the bottom-right such that the absolute height difference between any two adjacent cells along the path does not exceed `threshold`?
- **Monotonicity**: If `threshold = k` works, then `threshold = k+1` definitely works too. This monotonic property guarantees the correctness of binary search.
- **Search space**: The answer lies in `[0, maxHeight - minHeight]`. Binary search over this range, using BFS/DFS to verify feasibility at each step.

### BFS Implementation
```c++
class Solution {
private:
    int m, n;
    int dir[4][2] = { {0, 1}, {0, -1}, {1, 0}, {-1, 0} };

public:
    int minimumEffortPath(vector<vector<int>>& heights) {
        m = heights.size();
        n = m > 0 ? heights[0].size() : 0;
        int left = 0, right = 10e6;
        int res = -1;
        while (left <= right) {
            int mid = left + (right - left) / 2;
            bool reachable = bfs(heights, mid);
            if (reachable) {
                res = mid;
                right = mid - 1;
            }else {
                left = mid + 1;
            }
        }
        return left;
    }

    bool bfs(vector<vector<int>> &heights, int limit) {
        queue<pair<int, int>> q;
        q.push({0, 0});
        vector<vector<bool>> vis(m, vector<bool>(n, false));
        vis[0][0] = true;
        while (!q.empty()) {
            int x = q.front().first, y = q.front().second;
            q.pop();
            if (x == m - 1 && y == n - 1) {
                return true;
            }
            for (int i = 0; i < 4; i++) {
                int new_x = x + dir[i][0];
                int new_y = y + dir[i][1];
                if (new_x >= 0 && new_y >= 0 && new_x < m && new_y < n && !vis[new_x][new_y] && abs(heights[new_x][new_y] - heights[x][y]) <= limit) {
                    q.push({new_x, new_y});
                    vis[new_x][new_y] = true;
                }
            }
        }
        return false;
    }
}

```

### DFS Implementation
```c++
class Solution {
private:
    int m, n;
    int dir[4][2] = { {0, 1}, {0, -1}, {1, 0}, {-1, 0} };

public:
    int minimumEffortPath(vector<vector<int>>& heights) {
        m = heights.size();
        n = m > 0 ? heights[0].size() : 0;
        vector<vector<bool>> vis(m, vector<bool>(n, false));
        int left = 0, right = 10e6;
        while (left < right) {
            int mid = left + (right - left) / 2;
            for (int i = 0; i < m; i++) {
                std::fill(vis[i].begin(), vis[i].end(), false);
            }
            dfs(heights, 0, 0, mid, vis);
            if (vis[m - 1][n - 1]) {
                right = mid;
            }else {
                left = mid + 1;
            }
        }
        return left;
    }

    void dfs(vector<vector<int>> &heights, int x, int y, int threshold, vector<vector<bool>> &vis) {
        if (x < 0 || y < 0 || x >= m || y >= n || vis[x][y]) {
            return;
        }
        vis[x][y] = true;
        for (int i = 0; i < 4; i++) {
            int new_x = x + dir[i][0];
            int new_y = y + dir[i][1];
            if (new_x < 0 || new_y < 0 || new_x >= m || new_y >= n || vis[new_x][new_y]) {
                continue;
            }
            if (abs(heights[new_x][new_y] - heights[x][y]) > threshold) {
                continue;
            }
            dfs(heights, new_x, new_y, threshold, vis);
        }
    }
};
```

---

## Method 2: Union-Find (Kruskal Variant)

### Intuition

Take a different perspective: view the grid as a graph, where each pair of adjacent cells is connected by an edge whose weight is the absolute height difference.

The problem becomes: find a path from `(0,0)` to `(m-1,n-1)` in this graph that minimizes the maximum edge weight along the path.

**Kruskal's idea**: Sort all edges by weight in ascending order and add them one by one to the union-find structure. When the start and end cells become connected for the first time, the weight of the edge just added is the answer.

Why is this correct? Because we have only added edges with weight <= the current edge. The moment the start and end become connected, there exists a path whose maximum edge weight equals the current edge weight, and it cannot be smaller (otherwise they would have been connected earlier).

```c++
class UnionFind {
private:
    vector<int> pa;
    int count;
public:
    UnionFind(int n):pa(n), count(n) {
        for (int i = 0; i < n; i++) {
            pa[i] = i;
        }
    }
    int root(int x) {
        return x == pa[x] ? x : pa[x] = root(pa[x]);
    }
    void uni(int x, int y) {
        int px = root(x);
        int py = root(y);
        if (px != py) {
            pa[px] = py;
            count--;
        }
    }
    bool connected(int x, int y) {
        return root(x) == root(y);
    }
};

struct Edge {
    int x, y;
    int d;
    Edge(int _x, int _y, int _d): x(_x), y(_y), d(_d) {};
    bool operator < (const Edge &other) const {
        return d > other.d;
    }
};

class Solution {
public:
    int minimumEffortPath(vector<vector<int>>& heights) {
        int m = heights.size();
        int n = heights[0].size();
        priority_queue<Edge> edges;
        for (int i = 0; i < m; i++) {
            for (int j = 0; j < n; j++) {
                int id = i * n + j;
                if (i > 0) {
                    edges.push(Edge(id - n, id, abs(heights[i][j] - heights[i - 1][j])));
                }
                if (j > 0) {
                    edges.push(Edge(id - 1, id, abs(heights[i][j] - heights[i][j - 1])));
                }
            }
        }
        UnionFind uf(m * n);
        int res = 0;
        while (!edges.empty()) {
            Edge e = edges.top();
            edges.pop();
            uf.uni(e.x, e.y);
            if (uf.connected(0, m * n - 1)) {
                res = e.d;
                break;
            }
        }
        return res;
    }
};
```

---

## Method 3: Dijkstra (Adapted Relaxation Condition)

### Intuition

Classic Dijkstra finds the minimum *sum* of edge weights along a path, with the relaxation condition:

```
dist[v] = min(dist[v], dist[u] + w(u,v))
```

For this problem, we simply modify the relaxation condition to:

```
dist[v] = min(dist[v], max(dist[u], w(u,v)))
```

That is, the "distance" to reach `v` is defined as the maximum edge weight along the path. This variant still satisfies Dijkstra's greedy property: when a node is popped from the priority queue, its `dist` value is optimal, because any node popped later would have to pass through a larger edge.

```c++
struct Node {
    int x, y;
    int limit;
    Node(int _x, int _y, int _limit) : x(_x), y(_y), limit(_limit) {}
    bool operator < (const Node &other) const {
        return limit > other.limit;
    }
};

class Solution {
private:
    int dirs[4][2] = { {0, 1}, {0, -1}, {1, 0}, {-1, 0} };

public:
    int minimumEffortPath(vector<vector<int>>& heights) {
        int m = heights.size(), n = m > 0 ? heights[0].size() : 0;
        vector<vector<bool>> vis(m, vector<bool>(n, false));
        priority_queue<Node> pq;
        pq.emplace(Node(0, 0, 0));
        vector<int> dist(m * n, INT_MAX);
        dist[0] = 0;
        while (!pq.empty()) {
            Node node = pq.top();
            pq.pop();
            int x = node.x, y = node.y, limit = node.limit;
            if (vis[x][y]) {
                continue;
            }
            if (x == m - 1 && y == n - 1) {
                break;
            }
            vis[x][y] = true;
            for (int i = 0; i < 4; i++) {
                int nx = x + dirs[i][0];
                int ny = y + dirs[i][1];
                if (nx < 0 || ny < 0 || nx >= m || ny >= n) {
                    continue;
                }
                int new_limit = max(limit, abs(heights[nx][ny] - heights[x][y]));
                if (new_limit >= dist[nx * n + ny]) {
                    continue;
                }
                dist[nx * n + ny] = new_limit;
                pq.emplace(Node(nx, ny, new_limit));

            }
        }
        return dist.back();
    }
};
```

---

## Summary and Further Exploration

### Method Comparison

The three methods answer the same question from different angles:

- **Binary Search + BFS/DFS**: Guess the answer, verify feasibility. Suitable for problems where the answer is monotonic.
- **Union-Find**: Add edges from smallest to largest, observe when connectivity is established. Ideal for bottleneck path problems.
- **Dijkstra**: Greedy expansion, always taking the path with the smallest current cost. Suitable for shortest path variants that still satisfy the greedy property after adaptation.

### Related "Minimax Path" Problems

This "minimize the maximum edge weight along a path" type of problem appears frequently on LeetCode and in contests:

| Problem | Key Difference |
|---------|---------------|
| [778. Swim in Rising Water](https://leetcode.com/problems/swim-in-rising-water/) | Edge weight becomes max(grid[nx][ny], grid[x][y]) — you must wait for the water level to rise to the cell's height before passing |
| [1102. Path With Maximum Minimum Value](https://leetcode.com/problems/path-with-maximum-minimum-value/) | The reverse: maximize the minimum value along a path (maximin), also solvable with all three methods |
| [2812. Find the Safest Path in a Grid](https://leetcode.com/problems/find-the-safest-path-in-a-grid/) | First BFS-preprocess each cell's distance to the nearest threat, then find the maximin path |
| [1514. Path with Maximum Probability](https://leetcode.com/problems/path-with-maximum-probability/) | Edge weights are probabilities, path value is the product, solved with a max-variant of Dijkstra |

### The Broader "Binary Search the Answer + Verification" Pattern

"Binary search + BFS/DFS verification" is a general algorithmic design paradigm, applicable when:

- The answer lies within an ordered range
- The answer is monotonic (a clear boundary between feasible and infeasible)
- Given a candidate answer, the decision problem is significantly easier than the original

Common application scenarios:
- **Binary search + graph search**: This problem, Swim in Rising Water
- **Binary search + greedy**: Split Array Largest Sum ([410](https://leetcode.com/problems/split-array-largest-sum/))
- **Binary search + DP**: Find K-th Smallest Pair Distance ([719](https://leetcode.com/problems/find-k-th-smallest-pair-distance/))
