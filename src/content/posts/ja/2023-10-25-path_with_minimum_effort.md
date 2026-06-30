---
title: 'アルゴリズム総合問題：Path With Minimum Effort'
pubDate: 2023-10-25
categories: [アルゴリズム]
tags:
  - グラフ
  - LeetCode
  - Dijkstra

toc: true
description: 'LeetCode 1631を3つのアルゴリズム（二分探索+BFS/DFS、Union-Find、Dijkstra改造版）で解説。グリッド上のminimax経路問題を多角的に分析し、類似問題も紹介。'
---

## 問題概要

> [LeetCode 1631. Path With Minimum Effort](https://leetcode.com/problems/path-with-minimum-effort/)

You are a hiker preparing for an upcoming hike. You are given heights, a 2D array of size rows x columns, where heights[row][col] represents the height of cell (row, col). You are situated in the top-left cell, (0, 0), and you hope to travel to the bottom-right cell, (rows-1, columns-1) (i.e., 0-indexed). You can move up, down, left, or right, and you wish to find a route that requires the minimum effort.

A route's effort is the maximum absolute difference in heights between two consecutive cells of the route.

Return the minimum effort required to travel from the top-left cell to the bottom-right cell.

- 例1:

![ex1](../../../assets/images/posts/post-2023-10-25/ex1.png)

```
Input: heights = [[1,2,2],[3,8,2],[5,3,5]]
Output: 2
Explanation: The route of [1,3,5,3,5] has a maximum absolute difference of 2 in consecutive cells.
This is better than the route of [1,2,2,2,5], where the maximum absolute difference is 3.
```

## 考え方

この問題が優秀な総合問題である理由は、**少なくとも4つの異なるアルゴリズムパラダイム**で解くことができ、それぞれの解法が異なる思考の角度を示しているからです。

| 手法                 | 中心となる考え方                                    | 時間計算量             |
| -------------------- | --------------------------------------------------- | ---------------------- |
| 二分探索 + BFS/DFS   | 最適化問題を判定問題に変換                          | O(mn · log(maxHeight)) |
| Union-Find (Kruskal) | 問題を最小ボトルネック経路としてモデル化            | O(mn · log(mn))        |
| Dijkstra             | 最短経路アルゴリズムを改造し、緩和条件を max に変更 | O(mn · log(mn))        |

**重要な観察**：この問題が求めているのは、経路上の全辺の重みの和の最小値（古典的な最短経路）ではなく、経路上の**単一の辺の重みの最大値**の最小値です。このような "minimax path" 問題は、グラフ理論では**最小ボトルネック経路 (Minimum Bottleneck Path)** と呼ばれます。

---

## 方法1：Binary Search + BFS/DFS

### 考え方

最適化問題を判定問題に変換します。

- **判定問題**：閾値 `threshold` が与えられたとき、左上から右下までの経路であって、隣接セル間の高さの差がすべて `threshold` 以下となるものが存在するか？
- **単調性**：`threshold = k` で実行可能なら、`threshold = k+1` でも必ず実行可能です。この単調性が二分探索の正当性を保証します。
- **探索空間**：答えは `[0, maxHeight - minHeight]` の範囲にあります。この区間で二分探索を行い、毎回 BFS/DFS で実行可能性を検証します。

### BFS 実装

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

### DFS 実装

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

## 方法2：UnionFind（Kruskal 変種）

### 考え方

別の角度から考えます。グリッドをグラフと見なし、隣接するセルのペアごとに辺を張り、辺の重みを高さの差の絶対値とします。

問題は次のように変換されます：このグラフ上で `(0,0)` から `(m-1,n-1)` への経路のうち、経路上の最大辺重みが最小となるものを見つける。

**Kruskal の思想**：すべての辺を重みの昇順にソートし、順に Union-Find に追加していきます。スタートとゴールが初めて連結されたとき、最後に追加した辺の重みが答えとなります。

なぜ正しいのか？重みが現在の辺以下の辺のみを追加した時点でスタートとゴールが連結されたということは、最大辺重みが現在の辺重みと等しい経路が存在し、かつそれより小さくすることは不可能（そうでなければ既に連結されていたはず）だからです。

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

## 方法3：Dijkstra（緩和条件の改造）

### 考え方

古典的な Dijkstra は経路の辺重みの和の最小値を求めるもので、緩和条件は次の通りです。

```
dist[v] = min(dist[v], dist[u] + w(u,v))
```

この問題では緩和条件を次のように変更するだけです。

```
dist[v] = min(dist[v], max(dist[u], w(u,v)))
```

つまり、`v` に到達するための「距離」を経路上の最大辺重みと定義します。この変形でも Dijkstra の貪欲性は成立します。優先度付きキューから取り出されたノードの `dist` 値は必ず最適です。なぜなら、後から取り出されるノードはより大きな辺を経由することになるからです。

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

## まとめと発展

### 手法の比較

3つの手法は本質的に同じ問題を異なる視点から解いています。

- **二分探索 + BFS/DFS**：答えを推測し、実行可能性を検証する。答えに単調性がある場合に適用可能。
- **Union-Find**：小さい辺から順に追加し、いつ連結するかを観察する。ボトルネック経路問題に適している。
- **Dijkstra**：貪欲に拡張し、毎回現在の最小コストの経路を選ぶ。改造後も貪欲性が成立する最短経路の変種に適用可能。

### 類似の "Minimax Path" 問題

この「経路上の最大辺重みを最小化する」タイプの問題は、LeetCode や競技プログラミングで繰り返し登場します。

| 問題                                                                                                    | 核心となる違い                                                                              |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| [778. Swim in Rising Water](https://leetcode.com/problems/swim-in-rising-water/)                        | 辺重みが max(grid[nx][ny], grid[x][y]) になる。水位がセルの高さまで下がるのを待つ必要がある |
| [1102. Path With Maximum Minimum Value](https://leetcode.com/problems/path-with-maximum-minimum-value/) | 逆問題：経路上の最小値を最大化する (maximin)。同じ3つの手法が使える                         |
| [2812. Find the Safest Path in a Grid](https://leetcode.com/problems/find-the-safest-path-in-a-grid/)   | まず BFS で各セルから最も近い脅威までの距離を前計算し、その後 maximin path を求める         |
| [1514. Path with Maximum Probability](https://leetcode.com/problems/path-with-maximum-probability/)     | 辺重みが確率で、経路値は積の最大値。Dijkstra で max を取る変種                              |

### より広い「二分探索＋判定」パターン

「二分探索 + BFS/DFS 検証」は汎用的なアルゴリズム設計パラダイムであり、以下の条件を満たす問題に適用できます。

- 答えが順序付けられた区間内にある
- 答えに単調性がある（実行可能／不可能の境界点が存在する）
- 答えが与えられると、判定問題が元の問題よりはるかに簡単になる

よくある応用例：

- **二分探索 + グラフ探索**：本問題、Swim in Rising Water
- **二分探索 + 貪欲法**：配列分割の最大値 ([410](https://leetcode.com/problems/split-array-largest-sum/))
- **二分探索 + DP**：K 番目に小さい距離のペア ([719](https://leetcode.com/problems/find-k-th-smallest-pair-distance/))
