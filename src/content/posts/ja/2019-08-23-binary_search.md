---
title: '二分探索とその応用'
pubDate: 2019-08-23
categories: [アルゴリズム]
tags:
    - 二分探索
    - LeetCode

toc: true
description: '二分探索（Binary Search）の基本テンプレートから、境界検索、回転配列、二分探索木、答え空間での二分探索まで、応用例とC++実装を交えて解説する。'
---

## 概要

二分探索（`Binary Search`）は、別名「折半探索」「対数探索」とも呼ばれ、「答えが整列済みの区間や単調な空間内にある」検索問題に適用できる。核心的な考え方は、毎回区間の中点を選んでターゲットと比較し、探索空間を半分に絞り込むことで、最終的に `O(log n)` 時間で結果を特定し、追加の空間計算量は `O(1)` である。

```alert
type: success
description: **使用前提**：二分探索を使うには、対象空間が単調性（狭義単調増加、非減少、もしくは判定関数によって単調なブール値に変換可能）を持っている必要がある。LeetCode では[二分探索の特集練習](https://leetcode.com/tag/binary-search/)と[学習カード](https://leetcode.com/explore/learn/card/binary-search)が提供されており、体系的なトレーニング素材として適している。
```

## 一、よく使うテンプレートとテクニック

典型的な二分探索のループは以下のテンプレートに従う：

```cpp
/**
 * 標準二分探索テンプレート
 * @param nums 整列済み配列
 * @param target 目標値
 * @return 目標値のインデックス、見つからなければ -1
 */
int binary_search(const vector<int>& nums, int target) {
    // 探索区間を閉区間 [left, right] に初期化
    int left = 0, right = static_cast<int>(nums.size()) - 1;

    // 区間が空でない限り探索を続ける
    while (left <= right) {
        // 中点を計算、(right - left) / 2 を用いて整数オーバーフローを防ぐ
        int mid = left + (right - left) / 2;

        if (nums[mid] == target) {
            return mid;                      // ターゲットを発見、直接返す
        } else if (nums[mid] < target) {
            left = mid + 1;                  // ターゲットは右半分にある、左半分を捨てる
        } else {
            right = mid - 1;                 // ターゲットは左半分にある、右半分を捨てる
        }
    }
    return -1;                               // 探索区間が空、未発見
}
```

```alert
type: success
description: **重要なテクニック**：
- `left + (right - left) / 2` を使うことで `left + right` による整数オーバーフローを防止
- `while (left <= right)` と `left = mid + 1 / right = mid - 1` の組み合わせは閉区間 `[left, right]` に適用
- 半開区間 `[left, right)` を使用する場合、ループ条件は `left < right` とし、`right = mid` とする
- ループ終了時の意味を明確に理解する：`left` は最初の目標より大きい位置を指しており、上限・下限を求める問題に利用可能
- 二分探索は配列上だけでなく、答えの空間上でも探索できる。その場合は判定関数 `check(mid)` を独自に定義する
```

次に、代表的な問題を通してよくある応用シナリオを示す。

## 二、基本例題：整列済み配列での検索

最も基本的な二分探索問題は [LeetCode 704](https://leetcode.com/problems/binary-search/) である。ループ条件と境界の更新方法に注意すること。

```cpp
/**
 * LeetCode 704: 二分探索
 * 整列済み配列から目標値を検索
 */
int search(vector<int>& nums, int target) {
    int left = 0, right = static_cast<int>(nums.size()) - 1;

    while (left <= right) {
        int mid = left + (right - left) / 2;

        if (nums[mid] < target) {
            left = mid + 1;      // ターゲットは右半分
        } else if (nums[mid] > target) {
            right = mid - 1;    // ターゲットは左半分
        } else {
            return mid;          // ターゲットを発見
        }
    }
    return -1;                  // 未発見
}
```

### 2.1 変形：境界の検索

配列が重複要素を含む場合、よくある要件として目標値の最初または最後の位置を見つけることがある。例：[LeetCode 34](https://leetcode.com/problems/find-first-and-last-position-of-element-in-sorted-array/)。

```cpp
/**
 * 目標値の最初の位置を検索（lower_bound）
 * 半開区間 [left, right) を使用し、終了時 left は最初の >= target の位置を指す
 */
int lower_bound(const vector<int>& nums, int target) {
    int left = 0, right = static_cast<int>(nums.size());

    // 半開区間を使用、ループ条件は left < right
    while (left < right) {
        int mid = left + (right - left) / 2;

        if (nums[mid] < target) {
            left = mid + 1;      // ターゲットは右半分、mid および左側は答えになり得ない
        } else {
            right = mid;         // mid は答えの可能性があるため、mid を保持
        }
    }

    // left が有効かつ target と等しいかを確認
    return (left < nums.size() && nums[left] == target) ? left : -1;
}

/**
 * 目標値の最後の位置を検索（upper_bound）
 * 終了時 left は最初の > target の位置を指すので、最後の位置は left - 1
 */
int upper_bound(const vector<int>& nums, int target) {
    int left = 0, right = static_cast<int>(nums.size());

    while (left < right) {
        int mid = left + (right - left) / 2;

        if (nums[mid] <= target) {
            left = mid + 1;      // mid <= target、答えは右半分
        } else {
            right = mid;         // mid > target、mid は最初の > target の位置の可能性
        }
    }

    // left は最初の > target の位置を指すので、最後の target の位置は left - 1
    int idx = left - 1;
    return (idx >= 0 && nums[idx] == target) ? idx : -1;
}
```

```alert
type: info
description: **境界検索のテクニック**：
- `lower_bound`：最初の `>= target` の位置を検索する。挿入位置の検索に利用可能
- `upper_bound`：最初の `> target` の位置を検索する。`upper_bound - 1` は最後の `<= target` の位置
- 半開区間 `[left, right)` を使用する場合、ループ終了時に `left == right` となり、対象位置を指す
```

## 三、回転配列の問題

回転配列とは、昇順に整列された配列をあるピボット位置で切断し、前後の2つの部分を入れ替えて得られる新しい配列である。例えば `[0,1,2,4,5,6,7]` を回転させると `[4,5,6,7,0,1,2]` が得られる。このような配列は2つの部分に分かれ、それぞれ内部では整列されているため、二分探索を用いて目標値や最大値・最小値を特定できる。

```alert
type: info
description: **回転配列の特性**：回転後の配列は2つの部分に分かれ、各セグメント内では整列されている。`nums[left]` と `nums[mid]` を比較することで、どのセグメントが整列されているかを判断し、探索方向を決定する。
```

### 3.1 回転配列内での目標値検索

[LeetCode 33](https://leetcode.com/problems/search-in-rotated-sorted-array/) は重複要素がないことを前提とする。鍵となるのは、毎回 `nums[left]` と `nums[mid]` を比較してどちらの半分が整列されているかを判断し、どの部分を捨てるかを決定することである。

```cpp
/**
 * LeetCode 33: 回転ソート配列の検索（重複要素なし）
 * 核心：nums[left] と nums[mid] の比較により、どちらの半分が整列されているかを判断
 */
int search(vector<int>& nums, int target) {
    int left = 0, right = static_cast<int>(nums.size()) - 1;

    while (left <= right) {
        int mid = left + (right - left) / 2;

        if (nums[mid] == target) {
            return mid;
        }

        // 左半分 [left, mid] が整列されているか判断
        if (nums[left] <= nums[mid]) {
            // 左半分が整列、target が左半分の範囲内にあるか判断
            if (nums[left] <= target && target < nums[mid]) {
                right = mid - 1;    // target は左半分、左半分を探索
            } else {
                left = mid + 1;     // target は右半分、右半分を探索
            }
        } else {
            // 右半分 [mid, right] が整列、target が右半分の範囲内にあるか判断
            if (nums[mid] < target && target <= nums[right]) {
                left = mid + 1;     // target は右半分、右半分を探索
            } else {
                right = mid - 1;    // target は左半分、左半分を探索
            }
        }
    }
    return -1;
}
```

[LeetCode 81](https://leetcode.com/problems/search-in-rotated-sorted-array-ii/) は重複要素を許容する。この場合、`nums[left] == nums[mid]` のときはどちら側が整列されているかを判断できないため、左境界を収縮させる必要がある：

```cpp
/**
 * LeetCode 81: 回転ソート配列の検索 II（重複要素を許容）
 * nums[left] == nums[mid] のとき、どちら側が整列されているか判断できないため、線形収縮が必要
 */
int searchWithDuplicate(vector<int>& nums, int target) {
    int left = 0, right = static_cast<int>(nums.size()) - 1;

    while (left <= right) {
        int mid = left + (right - left) / 2;

        if (nums[mid] == target) {
            return mid;
        }

        if (nums[left] < nums[mid]) {
            // 左側が狭義単調増加、target が左半分にあるか判断可能
            if (nums[left] <= target && target < nums[mid]) {
                right = mid - 1;
            } else {
                left = mid + 1;
            }
        } else if (nums[left] > nums[mid]) {
            // 右側が増加、target が右半分にあるか判断可能
            if (nums[mid] < target && target <= nums[right]) {
                left = mid + 1;
            } else {
                right = mid - 1;
            }
        } else {
            // nums[left] == nums[mid]、どちら側が整列されているか判断できない
            // 例：[3,1,3,3,3] や [3,3,3,1,3]
            // 線形に左境界を収縮させるしかなく、最悪の時間計算量は O(n) に劣化
            left++;
        }
    }
    return -1;
}
```

### 3.2 最小要素の検索

[LeetCode 153](https://leetcode.com/problems/find-minimum-in-rotated-sorted-array/) は、重複のない回転配列から最小値を見つけることを求める。考え方は、二分探索で区間が整列されているかを判断し、もし `[left, right]` がすでに昇順に整列されていれば、直接 `nums[left]` を返す。そうでなければ、整列されていない半分に向かって収縮を続ける。

```cpp
/**
 * LeetCode 153: 回転ソート配列内の最小値の検索（重複要素なし）
 * 核心：最小値は必ず整列されていない半分に存在する
 */
int findMin(vector<int>& nums) {
    if (nums.empty()) return -1;

    int left = 0, right = static_cast<int>(nums.size()) - 1;

    while (left < right) {
        // 現在の区間がすでに整列されていれば、最小値は nums[left]
        if (nums[left] < nums[right]) {
            return nums[left];
        }

        int mid = left + (right - left) / 2;

        // どちらの半分が整列されていないかを判断、最小値は整列されていない半分にある
        if (nums[left] <= nums[mid]) {
            // 左半分が整列、最小値は右半分
            left = mid + 1;
        } else {
            // 右半分が整列、最小値は左半分（mid を含む）
            right = mid;
        }
    }
    return nums[left];
}
```

重複要素を許容する場合（[LeetCode 154](https://leetcode.com/problems/find-minimum-in-rotated-sorted-array-ii/)）、左右の区間を判断できないときは線形に一端を収縮させる：

```cpp
/**
 * LeetCode 154: 回転ソート配列内の最小値の検索 II（重複要素を許容）
 * nums[left] == nums[mid] のとき、最小値がどちら側にあるか判断できず、線形収縮が必要
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
            // 左半分が整列、最小値は右半分
            left = mid + 1;
        } else if (nums[left] > nums[mid]) {
            // 右半分が整列、最小値は左半分（mid を含む）
            right = mid;
        } else {
            // nums[left] == nums[mid]、判断できないため線形収縮
            // 例：[3,3,1,3] や [3,1,3,3]
            left++;
        }
    }
    return nums[left];
}
```

## 四、複数配列 / 多次元のシナリオ

### 4.1 2つの整列済み配列の中央値

[LeetCode 4](https://leetcode.com/problems/median-of-two-sorted-arrays/) は、2つの整列済み配列から中央値を見つける問題である。単純にマージする場合の計算量は `O(m+n)` だが、二分探索を用いると `O(log(min(m,n)))` で解くことができる。短い方の配列の位置を二分探索で決め、左右の要素数が中央値の条件を満たすようにする。詳細な導出は[議論スレッド](https://leetcode.com/problems/median-of-two-sorted-arrays/discuss/2471/very-concise-ologminmn-iterative-solution-with-detailed-explanation)を参照。

```alert
type: success
description: **計算量の最適化**：二分探索により時間計算量を `O(m+n)` から `O(log(min(m,n)))` に最適化できる。これは二分探索が複雑な問題において応用される典型的な例である。
```

### 4.2 二次元行列の探索

[LeetCode 74](https://leetcode.com/problems/search-a-2d-matrix/) は行列から目標値を探索する問題である。よく使われる方法は2つある：
- **方法1**：先に最初の列で二分探索して行を特定し、その後その行内で二分探索する（2回の二分探索）
- **方法2**：行列を一次元配列とみなし、インデックスマッピング `row = mid / n`、`col = mid % n` を使って1回の二分探索で済ませる

**方法1：2回の二分探索**

```cpp
/**
 * LeetCode 74: 二次元行列の探索（方法1：2回の二分探索）
 * 先に行を特定し、その後その行内で探索
 */
bool searchMatrix(vector<vector<int>>& matrix, int target) {
    if (matrix.empty() || matrix[0].empty()) return false;

    // 高速判定：target が行列の範囲外にあれば直接 false を返す
    if (target < matrix[0][0] || matrix.back().back() < target) {
        return false;
    }

    // 第一步：最初の列で二分探索し、target が存在する可能性のある行を見つける
    int left = 0, right = matrix.size() - 1;
    while (left <= right) {
        int mid = left + (right - left) / 2;
        if (matrix[mid][0] < target) {
            left = mid + 1;
        } else if (matrix[mid][0] > target) {
            right = mid - 1;
        } else {
            return true;  // 最初の列の要素が target と一致
        }
    }

    // right は最初の列要素が target より小さい最後の行を指す
    int row = right;
    if (row < 0) return false;

    // 第二步：特定した行内で二分探索
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

**方法2：1回の二分探索（推奨）**

```cpp
/**
 * LeetCode 74: 二次元行列の探索（方法2：1回の二分探索）
 * 二次元行列を一次元配列とみなし、インデックスマッピングで二分探索を実行
 */
bool searchMatrix(vector<vector<int>>& matrix, int target) {
    if (matrix.empty() || matrix[0].empty()) return false;

    // 高速判定
    if (target < matrix[0][0] || matrix.back().back() < target) {
        return false;
    }

    int m = matrix.size(), n = matrix[0].size();
    int left = 0, right = m * n - 1;  // 行列を長さ m*n の一次元配列とみなす

    while (left <= right) {
        int mid = left + (right - left) / 2;

        // 一次元インデックス mid を二次元座標 (row, col) にマッピング
        int row = mid / n;      // 行インデックス
        int col = mid % n;      // 列インデックス
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
description: **インデックスマッピングのテクニック**：`m × n` の行列において、一次元インデックス `i` に対応する二次元座標は `(i / n, i % n)` である。この方法により二次元問題を一次元問題に変換でき、実装を簡略化できる。
```

## 五、木構造における二分探索の考え方

二分探索は配列だけでなく、探索空間を素早く絞り込めるデータ構造であれば同様の考え方を応用できる。二分探索木（BST）は中間順走査により整列済みの系列になるため、二分探索と同様の考え方で要素を特定できる。

### 5.1 二分探索木で k 番目に小さい要素を検索

[LeetCode 230](https://leetcode.com/problems/kth-smallest-element-in-a-bst/) は、k 番目に小さいノードを見つける問題である。ノード数カウントやスタックを用いた中間順走査のシミュレーションで実現できる：

**方法1：再帰 + ノード数カウント**

```cpp
/**
 * LeetCode 230: 二分探索木で K 番目に小さい要素（再帰メソッド）
 * BST の性質を利用：左部分木 < 根 < 右部分木
 */
int kthSmallest(TreeNode* root, int k) {
    // 左部分木のノード数を計算
    int count = countNodes(root->left);

    if (k <= count) {
        // k 番目に小さい要素は左部分木にある
        return kthSmallest(root->left, k);
    } else if (k > count + 1) {
        // k 番目に小さい要素は右部分木にある。左部分木と根ノードの数を引く必要がある
        return kthSmallest(root->right, k - count - 1);
    } else {
        // k == count + 1、現在の根ノードが k 番目に小さい要素
        return root->val;
    }
}

/**
 * node を根とする部分木のノード数を計算
 */
int countNodes(TreeNode *node) {
    if (!node) return 0;
    return 1 + countNodes(node->left) + countNodes(node->right);
}
```

**方法2：反復 + 中間順走査**

```cpp
/**
 * LeetCode 230: 二分探索木で K 番目に小さい要素（反復メソッド）
 * スタックを用いて中間順走査をシミュレートし、k 番目のノードを見つける
 */
int kthSmallest(TreeNode* root, int k) {
    stack<TreeNode *> s;
    TreeNode *p = root;
    int cnt = 0;

    // 中間順走査：左 -> 根 -> 右
    while (!s.empty() || p) {
        // 左端のノードまで進む
        while (p) {
            s.push(p);
            p = p->left;
        }

        // 現在のノードにアクセス（中間順走査の根ノード）
        p = s.top();
        s.pop();
        cnt++;

        // k 番目のノードにアクセスしたらその値を返す
        if (cnt == k) {
            return p->val;
        }

        // 右部分木へ移動
        p = p->right;
    }
    return -1;
}
```

### 5.2 完全二分木への新規ノード挿入

[LeetCode 919](https://leetcode.com/problems/complete-binary-tree-inserter/)（Google 新卒採用面接問題）：完全二分木が与えられたとき、新規ノードを挿入してもなお完全二分木のままとする。

**方法1：BFS による挿入位置の検索**

```cpp
/**
 * 方法1：BFS を使用して最初に子ノードが不足しているノードを見つける
 * 時間計算量 O(n)、空間計算量 O(n)
 */
void insert(TreeNode *root, TreeNode *newNode) {
    if (!root) return;

    queue<TreeNode*> q;
    q.push(root);

    while (!q.empty()) {
        TreeNode* node = q.front();
        q.pop();

        // 優先的に左子ノードに挿入
        if (!node->left) {
            node->left = newNode;
            break;
        }
        // 左子ノードが既にあれば右子ノードに挿入
        if (!node->right) {
            node->right = newNode;
            break;
        }

        // 現在のノードが満杯なら走査を続ける
        q.push(node->left);
        q.push(node->right);
    }
}
```

**方法2：ノード数カウント + 二進数経路（推奨）**

```cpp
/**
 * 方法2：完全二分木の性質 + 二進数経路による位置特定
 * 時間計算量 O(log n)、空間計算量 O(1)
 *
 * 核心的な考え方：
 * 1. 完全二分木をレベル順に番号付けすると、新しいノードの番号は count + 1
 * 2. 新しいノードの親ノードの番号は (count + 1) / 2
 * 3. 二進数で経路を表現：0 は左、1 は右
 */
class CBTInserter {
public:
    explicit CBTInserter(TreeNode* r) : root(r), count(countNodes(r)) {}

    /**
     * 新規ノードを挿入
     * @param val 新規ノードの値
     * @return 親ノードの値
     */
    int insert(int val) {
        ++count;  // 新規ノードの番号

        // 新規ノードの親ノードを特定（番号は count / 2）
        TreeNode* parent = locateParent(count / 2);

        // 新規ノードを作成
        TreeNode* node = new TreeNode(val);

        // 番号の偶奇によって左部分木か右部分木に挿入
        // 偶数番号 -> 左部分木、奇数番号 -> 右部分木
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
    int count;  // 現在のノード総数

    /**
     * node を根とする部分木のノード数を計算
     */
    int countNodes(TreeNode* node) {
        if (!node) return 0;
        return 1 + countNodes(node->left) + countNodes(node->right);
    }

    /**
     * レベル順番号からノードを特定
     * @param idx ノードのレベル順番号（1 から始まる）
     * @return 対応するノード
     *
     * アルゴリズム：idx を二進数に変換し、上位ビットから下位ビットへ根から対象ノードへの経路を表す
     * 例：idx = 6（二進数 110）-> 根 -> 右 -> 左
     */
    TreeNode* locateParent(int idx) {
        // idx を二進数の経路に変換（下位ビットから）
        vector<int> path;
        while (idx > 1) {
            path.push_back(idx % 2);  // 0 は左、1 は右
            idx /= 2;
        }

        // 根ノードから経路に従って下へたどる
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
description: **完全二分木の性質**：完全二分木のノードをレベル順に番号付けすると、番号 `i` のノードの左子ノードの番号は `2i`、右子ノードの番号は `2i+1`、親ノードの番号は `⌊i/2⌋` となる。この性質を利用することで、二進数経路による高速なノード位置特定が可能になる。
```

## 六、答え空間での二分探索

結果を直接特定できないが、「与えられた答えが実行可能かどうか」を判断できる場合、答えの空間で二分探索を適用できる。この種の問題の鍵は、判定関数 `check(mid)` を設計し、答え `mid` が条件を満たすかどうかを判断することである。

```alert
type: success
description: **答え空間での二分探索**：配列内を直接探索するのではなく、可能な答えの範囲内で探索する。判定関数を設計してある答えが実行可能かを判断し、その結果に基づいて探索範囲を絞り込む必要がある。
```

### 6.1 LeetCode 69：`Sqrt(x)`

```cpp
/**
 * LeetCode 69: x の平方根
 * 答え空間 [1, x/2] で二分探索
 * 判定関数：mid * mid <= x
 */
int mySqrt(int x) {
    if (x < 2) return x;  // 0 と 1 の平方根は自分自身

    // 答え空間：[1, x/2]
    // なぜなら sqrt(x) <= x/2（x >= 4 の場合）
    int left = 1, right = x / 2, ans = 1;

    while (left <= right) {
        int mid = left + (right - left) / 2;
        long long square = 1LL * mid * mid;  // オーバーフロー防止

        if (square == x) {
            return mid;           // 正確な値を発見
        } else if (square < x) {
            ans = mid;            // 条件を満たす現在の最大値を記録
            left = mid + 1;       // より大きな値を試す
        } else {
            right = mid - 1;      // 平方が大きすぎるため上界を縮小
        }
    }
    return ans;  // mid*mid <= x を満たす最大の値を返す
}
```

### 6.2 Google：ケーキ分割問題

**問題文**：`n` 人で複数の円形ケーキを分け合う。各ケーキの半径は既知で、複数の扇形に切り分けることができる。一人あたりが獲得できる最大の面積を求めよ。

**考え方**：答え空間 `[0, max(ケーキの面積)]` で二分探索を行う。判定関数 `check(mid)`：全てのケーキから切り出せるピースの数が `n` 以上かどうかを計算する。

```cpp
/**
 * 判定関数：一人あたり mid の面積を分け与えるとき、n 人を満たせるかどうかを判断
 * @param areas 全ケーキの面積
 * @param mid 一人あたりの面積
 * @param n 人数
 * @return n 人を満たせるかどうか
 */
bool check(const vector<double>& areas, double mid, int n) {
    int cnt = 0;
    for (double a : areas) {
        // 各ケーキから切り出せるピース数 = ケーキ面積 / 一人あたりの面積
        cnt += static_cast<int>(a / mid);
        // すでに n 人を満たせれば早期リターン
        if (cnt >= n) return true;
    }
    return false;
}

/**
 * ケーキ分割問題：一人あたりが獲得できる最大面積を求める
 * @param radii 各ケーキの半径
 * @param n 人数
 * @return 一人あたりが獲得できる最大面積
 */
double maximumAreaServingCake(const vector<int>& radii, int n) {
    const double PI = acos(-1.0);
    vector<double> areas(radii.size());
    double hi = 0.0;

    // 各ケーキの面積を計算し、最大面積を上界とする
    for (size_t i = 0; i < radii.size(); ++i) {
        areas[i] = PI * radii[i] * radii[i];
        hi = max(hi, areas[i]);
    }

    // 答え空間：[0, max(ケーキの面積)]
    double lo = 0.0;

    // 浮動小数点数の二分探索：固定回数の反復で十分な精度を得る
    // 60 回の反復で約 1e-18 の精度を達成可能
    for (int iter = 0; iter < 60; ++iter) {
        double mid = (lo + hi) / 2.0;

        // mid が条件を満たせば、答えはより大きい可能性があるため下界を上げる
        // そうでなければ答えはより小さいため上界を下げる
        if (mid > 0 && check(areas, mid, n)) {
            lo = mid;
        } else {
            hi = mid;
        }
    }
    return lo;  // 条件を満たす最大面積を返す
}
```

```alert
type: info
description: **浮動小数点数の二分探索テクニック**：浮動小数点数の答え空間では、`while (left < right)` ではなく固定反復回数を使用するのが一般的である。浮動小数点数の比較は無限ループに陥る可能性があるためである。60 回の反復で通常は十分な精度に達する。
```

## 七、まとめ

二分探索は効率的で応用範囲の広いアルゴリズムである。その核心的な考え方と一般的なバリエーションを習得することは、様々な問題を解決する上で非常に有用である。

### 重要なポイント

1. **使用前提**：問題が単調性を持つかどうかを判断することが、二分探索を選択する前提条件である
2. **区間処理**：区間の種類（閉区間 `[left, right]` / 半開区間 `[left, right)`）に応じてループ条件と境界更新を調整する
3. **構造への適応**：回転配列、二次元行列、木などの構造では、構造特性に応じて分割方法を決定する必要がある
4. **答え空間での二分探索**：答え空間で二分探索を行う場合、適切な判定関数 `check(mid)` を設計することが鍵となる
5. **実践上のアドバイス**：テンプレートを整理し、オーバーフローと無限ループに注意し、練習を通じて境界条件の考え方を固める
