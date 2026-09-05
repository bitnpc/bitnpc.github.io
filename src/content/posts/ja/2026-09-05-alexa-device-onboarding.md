---
title: 'Alexa デバイスオンボーディング完全解説'
pubDate: 2026-09-05
categories: [スマートホーム]
tags:
  - Alexa
  - IoT
  - MCP
  - Smart Home
toc: true
translationKey: 'alexa-device-onboarding'
description: 'ACK ハードウェアオンボーディングから Smart Home AI Toolkit の AI セマンティックレイヤー、Discover.Response 能力宣言、コントロール UI の自動生成、状態同期 3 チャネルと二層認証まで——「オンボーディング方式 → 能力宣言 → UI 生成 → 連携・同期 → 公開」の流れで、Alexa プラットフォームのデバイス接入の全体像を整理する。'
---

## はじめに：Alexa デバイスオンボーディングの全体像

Alexa は Amazon の音声アシスタントエコシステムであり、2014 年に Echo デバイスとともに登場して以来、「音声コマンドエンジン」として存在してきた——ユーザーが固定のウェイクワードと意図を発話し、Alexa が事前学習済みの NLU（自然言語理解）モデルで意図を識別して対応する Skill にルーティングする。2025 年 2 月、Amazon は次世代の **Alexa+** プラットフォームを発表し、2026 年 7 月の Partner Summit で Preview を公開した。その核心的な転換は次のように要約できる：

> 「音声コマンドエンジン」から「AI Agent プラットフォーム」へ

これは 3 つのレイヤーで現れる：

1. **ランタイムのアップグレード**：従来の NLU + イントエンドルーティングエンジンが LLM によって強化または置換される。以前は事前学習済みの意味理解モデル（非 LLM）が定義済み意図の識別を行っていたが、現在は LLM が動的な意図識別を行い、モデルの再学習・再デプロイなしに理解範囲を拡張できる。
2. **能力露出のアップグレード**：デバイス能力は定義済みの Capability Interfaces（PowerController / ModeController など）に限定されず、AI セマンティック記述レイヤーで自由に宣言できる。
3. **エコシステムの拡張**：MCP（Model Context Protocol）により、サードパーティプロバイダーは Alexa+ にツールを提供でき、Alexa+ も外部 Agent の能力を呼び出せる。

デバイスオンボーディングの観点から見ると、Alexa プラットフォームは直交する 2 つのレイヤーで接入方式を提供する：

- **ハードウェア／ファームウェア層**：ACK（Alexa Connect Kit）。Amazon が全面管理するデバイス接続ソリューションで、ベンダーは自前のクラウド不要。
- **ソフトウェア／能力層**：Add-on。ベンダーがデバイス能力を宣言し、Alexa が識別・制御する。Alexa+ はこの層に Smart Home AI Toolkit を追加し、Category SDK と MCP Toolkit の 2 つの新しいパスを導入した。

本記事は「オンボーディング方式 → 能力宣言 → コントロール UI 生成 → 連携・同期 → 公開」という主線に沿って、Alexa プラットフォームのデバイスオンボーディングの完全な流れを整理し、そのうちどの部分が Alexa+ で追加されたものかを明示する。

## 1. オンボーディング方式の概観

### 1.1 ハードウェア層：ACK（Alexa Connect Kit）

ACK は Amazon の全面管理型デバイスオンボーディングソリューションで、自前のクラウドも Skill 開発もなしでデバイスを Alexa に接入できる。ACK には 3 つのハードウェア形態がある：

| 形態                   | アーキテクチャ                                                            | 適用シーン                                                  |
| ---------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------- |
| **ACK Module**         | 2 チップ：ACK Module（Amazon ファームウェア、Wi-Fi + 証明書、UART）+ HMCU | 既存 MCU を持つベンダー（コーヒーメーカー、電子レンジなど） |
| **ACK SDK**            | シングルチップ：ベンダー SoC が ACK SDK ソースを実行                      | BoM 削減を狙う照明/コンセント OEM                           |
| **ACK SDK for Matter** | シングルチップで Matter over Wi-Fi を実行                                 | Matter 認証も取得するベンダー                               |

![Build with ACK — Amazon 全托管](../../../assets/images/posts/post-2026-09-05/01-ack-compare.png)

ACK における Amazon の役割は包括的である：

- 完全なデバイス側 SDK を提供し、ベンダーはデバイスレベルのコールバック（「リレーを駆動 / モーターを回転」など）を実装するだけ
- Wi-Fi スタック、セキュリティ証明書、OTA クライアントを管理
- クラウドをホスト（デバイス登録、OTA、メトリクス、プロビジョニング）
- デバイス 1 台あたり 1 回限りの課金、自前クラウド不要

ACK は Alexa の従来型デバイスオンボーディングの枠組みに属し、Alexa+ for Builders の Add-on 範疇ではないが、ハードウェア層で最も手間のかからない接入パスであり、ソフトウェア層の Smart Home Add-on と組み合わせて使われることが多い。

### 1.2 ソフトウェア／能力層：3 つの Add-on パス

Alexa+ for Builders は現在 3 つの Add-on 統合パスを提供し、いずれも Preview 段階である：

| パス                      | 位置付け                                  | 対象                 | 納期                                   |
| ------------------------- | ----------------------------------------- | -------------------- | -------------------------------------- |
| **Smart Home AI Toolkit** | デバイス固有能力 → AI セマンティック記述  | デバイスメーカー     | 時間単位                               |
| **Category SDK**          | 6 つの生活サービスカテゴリ → SPI/MCP 契約 | サービスプロバイダー | 週単位                                 |
| **MCP Toolkit**           | 汎用 MCP サービス接入 → ツール呼び出し    | 任意のプロバイダー   | 既存 MCP Server があれば小幅な修正のみ |

> 注：公式ブログでは Smart Home AI Toolkit を _AI-powered smart home developer toolkit_ と呼び、開発ドキュメントでは両者が混用される。本記事では Smart Home AI Toolkit という略称を用いる。

3 つのパスに共通する特徴は **AI-first な統合パラダイム**である——開発者は**自然言語記述、仕様ドキュメントのアップロード**、または標準的な **MCP Server** の公開によって接入を完了し、従来の手書きインターフェースコードは不要になる。

第 2 章では Smart Home AI Toolkit を主線に能力宣言を解説し、Category SDK と MCP Toolkit は第 6 章で展開する。

## 2. デバイス能力の宣言

ソフトウェア層のパスを問わず、デバイス接入の第一歩は Alexa に対して「このデバイスが何の能力を持つか」を宣言することである。これは `Discover.Response` で行う。

### 2.1 宣言構造：Discover.Response

Alexa がデバイスを検索する際、ベンダーのスキルエンドポイント（AWS Lambda など）に Discovery リクエストを送る。ベンダーは `Discover.Response` を返し、`endpoints[].capabilities[]` でデバイスがサポートする能力とパラメータを宣言する。カメラの例（抜粋）：

```json
{
  "endpointId": "camera-001",
  "friendlyName": "リビングカメラ",
  "displayCategories": ["CAMERA"],
  "capabilities": [
    {
      "type": "AlexaInterface",
      "interface": "Alexa.PowerController",
      "version": "3",
      "properties": {
        "supported": [{ "name": "powerState" }],
        "retrievable": true,
        "proactivelyReported": true
      }
    },
    {
      "type": "AlexaInterface",
      "interface": "Alexa.CameraStreamController",
      "version": "3",
      "cameraStreamConfigurations": [
        {
          "protocols": ["RTSP"],
          "resolutions": [{ "width": 1920, "height": 1080 }],
          "authorizationType": "BASIC",
          "videoCodec": "H264"
        }
      ]
    },
    {
      "type": "AlexaInterface",
      "interface": "Alexa.RangeController",
      "version": "3",
      "instance": "Camera.Pan",
      "capabilityResources": {
        "friendlyNames": [{ "@type": "text", "value": { "text": "Pan", "locale": "en-US" } }]
      },
      "properties": {
        "supported": [{ "name": "rangeValue" }],
        "retrievable": true,
        "proactivelyReported": true
      },
      "configuration": {
        "supportedRange": { "minimumValue": -200, "maximumValue": 200, "precision": 1 }
      }
    }
  ]
}
```

`capabilities[]` のうち、コントロール UI のスタイルに影響する主要な設定項目：

| 設定項目                         | ベンダーが設定する内容                                                               |
| -------------------------------- | ------------------------------------------------------------------------------------ |
| `displayCategories`              | デバイスカテゴリ（ページ骨格レイアウトを決定）                                       |
| `interface`                      | どの能力プロトコルをサポートするか（コントロール種別を決定、2.2 参照）               |
| `instance`                       | 同一インターフェースの複数インスタンスを区別する名前（複数の独立コントロールを生成） |
| `properties.supported`           | このインターフェースが報告するプロパティ名（コントロールのデータソース）             |
| `properties.retrievable`         | Alexa が ReportState で現在値を照会できるか（初期値の表示可否、4.1 参照）            |
| `properties.proactivelyReported` | プロパティ変化時に ChangeReport を送るか（リアルタイム更新可否、4.1 参照）           |
| `configuration`                  | 能力パラメータ、`supportedRange`（min/max/precision）、`presets` など                |
| `capabilityResources`            | コントロールリソース、アイコン名・多言語などを含む                                   |
| `cameraStreamConfigurations`     | 映像ストリームパラメータ（プロトコル/解像度/コーデック/認証）                        |
| `nonControllable: true`          | 読み取り専用フラグ → コントロールは表示のみ、操作不可                                |

### 2.2 標準能力：Capability Interfaces

`interface` フィールドがコントロール種別を決定する。Alexa Smart Home は定義済みの Capability Interfaces を持ち、各インターフェースは一連のプロトコルディレクティブと 1 つの UI コントロールに対応する：

| interface                      | プロトコルディレクティブ         | 推定コントロール               |
| ------------------------------ | -------------------------------- | ------------------------------ |
| `Alexa.PowerController`        | TurnOn / TurnOff                 | スイッチ                       |
| `Alexa.BrightnessController`   | SetBrightness / AdjustBrightness | 明るさスライダー               |
| `Alexa.RangeController`        | SetRangeValue / AdjustRangeValue | 数値スライダー                 |
| `Alexa.ModeController`         | SetMode / AdjustMode             | モードセレクタ                 |
| `Alexa.ToggleController`       | TurnOn / TurnOff                 | スイッチ（インスタンス名付き） |
| `Alexa.LockController`         | Lock / Unlock                    | ロック制御（解除は認証が必要） |
| `Alexa.CameraStreamController` | InitializeCameraStreams          | 動画プレーヤー                 |
| `Alexa.MotionSensor`           | detectionState のみ報告          | 検知バッジ                     |
| `Alexa.EndpointHealth`         | connectivity のみ報告            | オンライン/オフライン表示      |

コントロール種別は `interface` で決まる（ブラックボックス、マッピングアルゴリズムは非公開）。コントロールのパラメータ（範囲/ステップ/名前/プリセット）は `configuration` / `capabilityResources` で決まる（ベンダー設定可能）。同一 `interface` は複数回宣言でき、`instance` で区別し、各インスタンスが**独立したコントロール**を生成する。

標準インターフェースの限界：デバイス固有の機能（洗濯機の 30 種の洗濯モード、カメラの暗視/人追跡など）は定義済みインターフェースでは表現できない。従来の手法では、ベンダーはこれらを `ModeController` や `RangeController` に押し込むフォールバックしかなく、セマンティック情報が失われていた。

### 2.3 カスタム能力（Alexa+ で追加）：Smart Home AI Toolkit

Smart Home AI Toolkit は Alexa+ のスマートホーム領域における最も重要な追加機能で、「標準インターフェースではカバーできないカスタム機能」の問題に特化して解決する。標準能力の上に **AI セマンティック記述レイヤー**を重ねる：

```plaintext
従来: デバイス → Capability Interfaces（標準のみ）→ Alexa NLU（定義済み Skill Interaction Model）
新方式: デバイス → Capability Interfaces + AI セマンティックレイヤー → Alexa+ LLM（自然言語マッチング + パラメータ推論）
```

#### 2 つの新しいコントローラ

Smart Home AI Toolkit は「以前は露出できなかった」カスタム能力を担う 2 種類の新しいコントローラを導入する：

| コントローラ                                        | 機能                                     | 適用例                                                             |
| --------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------ |
| **Action Controller**（`Alexa.ActionController`）   | 名前付きアクションやシーンをトリガー     | 「就寝モード開始」「フィルター洗浄」「ディープクリーニング開始」   |
| **Dynamic Controller**（`Alexa.DynamicController`） | デバイスの動的パラメータ組み合わせを露出 | 洗濯モード選択（洗い + 水温 + 脱水回転の組み合わせ）、エアコン風向 |

鍵となる革新：この 2 つのコントローラの**セマンティック空間は未定義**であり、ベンダーが能力記述の中でセマンティック、パラメータのエイリアス、自然言語ラベルを自由に宣言し、Alexa+ の LLM が自然言語マッチングとパラメータ推論を担う。

![Smart Home AI Toolkit](../../../assets/images/posts/post-2026-09-05/02-smart-home-ai-toolkit.png)

洗濯機の例——ベンダーがセマンティック記述でデバイス固有能力を定義する：

```json
{
  "type": "AlexaInterface",
  "interface": "Alexa.ActionController",
  "capabilityResources": {
    "friendlyNames": [{ "type": "asset", "value": { "assetId": "Alexa.Setting.WashCycle" } }]
  },
  "semantics": {
    "deviceActions": {
      "name": "cold_water_enzyme",
      "description": "A cold-water wash cycle that activates enzyme-based stain removal, suitable for delicate fabrics that require cold washing",
      "parameters": {
        "temperature": "cold",
        "enzyme_activation": true,
        "spin_speed": "medium"
      },
      "keywords": ["cold wash", "enzyme", "stain removal", "gentle clean", "delicate"]
    }
  },
  "version": "3"
}
```

`semantics` ブロックに注目——ベンダーは `description` と `keywords` でこのアクションの意味を自然言語で記述し、Alexa+ の LLM が実行時にユーザーの発話（「冷水で優しく洗って」など）からこのアクションをマッチングし、パラメータを推論する。これが LLM ランタイムが従来の NLU 学習モデルを置き換える核心的な姿である。

#### 2 つの宣言方式

Smart Home AI Toolkit は Alexa Developer Console 内でセマンティック能力記述を生成する 2 つの方式を提供する：

| 方式                     | 説明                                                                                                                               | 適用シーン                         |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| **Chat & Build**         | 自然言語でデバイス機能を記述（「ペットフィーダー、給餌、洗浄、残量表示ができる」など）し、Agent がセマンティック能力記述を自動生成 | 初回接入 / 迅速なプロトタイピング  |
| **Upload Specification** | PDF のデバイス仕様書をアップロードし、LLM が能力を自動抽出して欠落を補完                                                           | 既に成熟した製品仕様を持つベンダー |

両方式の産物は同じ：**セマンティック能力記述ファイル**（構造化 JSON/YAML）で、デバイス固有能力のセマンティック、パラメータ、自然言語エイリアス、UI ヒントを定義する。このファイルは既存の Smart Home Add-on に直接マウントされて Alexa+ から呼び出され、標準能力と `capabilities` 配列内で**同列**となる（カスタムインターフェース名は `Alexa.Custom.AnyCompany.SampleController` の形）。

#### 留意すべき詳細

- **追加認証不要**：AI Toolkit が生成した能力は既存の WWA（Works with Alexa）認証範囲をそのまま再利用し、新機能が再認証をトリガーしない
- **インクリメンタルに重ねる**：ゼロから作り直さない——ベンダーは標準 Capability Interfaces の完全な制御を保ち、AI セマンティック記述は追加のマウントレイヤーに過ぎない
- **すべて Portal 内で完結**：すべての操作は Alexa Developer Console 内で行われ、ローカル CLI や SDK のインストール不要
- **初提携ブランド**：Bosch、Delta、Ecovacs、Eufy、Govee、iRobot、Moen Flo、PetSafe、Pila Energy、SONOFF、TP-Link Tapo、Twinkly、Whirlpool、Yale Home——白物家電、清掃、セキュリティ、照明を網羅

## 3. デバイスコントロール UI の自動生成

能力を宣言すると、Alexa App のデバイスコントロールページが**自動生成**され、ベンダーは UI コードを書く必要がない。これは Alexa Smart Home の Catalog Service 機能であり、Smart Home AI Toolkit で追加されたコントローラも同様に UI を自動生成する。

### 核心原理

```plaintext
ベンダーが能力を宣言（Discover.Response）
   → Alexa が「能力 → UI コントロール」のマッピング表を管理
   → デバイスコントロールページを自動生成
```

3 つの要点：

1. ベンダーが能力を宣言し、Alexa が能力→UI マッピング表を管理してページを自動生成する
2. ページにビジネスロジックはない：UI は「状態表示 + 操作をディレクティブに翻訳」のみを行い、実際の実行はベンダー定義のクラウド関数（Lambda など）にある
3. 状態は 3 つのチャネルで一貫性を保つ：ページを開いて初期値を取得 → ユーザー操作で新値を書き込み → デバイス変化を能動的にプッシュ

### 組立ルール

レンダラーがエンドポイント宣言を読み取った後：

```plaintext
capabilities 配列
   → 各 interface を巡回
   → 各 interface（instance 含む）が 1 つのコントロールを生成
   → displayCategories がページ骨格（カテゴリアイコン / コントロールページ形式）を決定
   → すべてのコントロールを 1 ページに組み上げ
```

カメラの例、組立結果：

```plaintext
Alexa（ベース）          → 可視コントロールなし
EndpointHealth            → オンライン/オフライン表示
CameraStreamController    → 動画プレーヤー
PowerController           → スイッチ
MotionSensor              → 検知バッジ
RangeController(Pan)      → 水平スライダー（-200~200）
RangeController(Tilt)     → 垂直スライダー（-50~50）
カスタム: NightVision     → AI 生成のスイッチ
カスタム: HumanTracking   → AI 生成のボタン
```

組立後の UI 構造イメージ：

```plaintext
┌─────────────────────────────────────────┐
│  ● オンライン        リビングカメラ  ⚙️ │  ← EndpointHealth + friendlyName
├─────────────────────────────────────────┤
│         ┌─────────────────┐             │
│         │  ストリーム(RTSP) │             │  ← CameraStreamController
│         │  1080p / H.264   │             │
│         └─────────────────┘             │
├──────────────────┬──────────────────────┤
│  ◉ 電源           │  ⚠ モーション: 正常   │  ← PowerController + MotionSensor
├──────────────────┴──────────────────────┤
│  Pan  ◄━━━━━━━━━●━━━━━━━━━► -200~200   │  ← RangeController(Camera.Pan)
│  Tilt ◄━━━━●━━━━━━━━━━━━━━► -50~50     │  ← RangeController(Camera.Tilt)
├─────────────────────────────────────────┤
│  🌙 暗視 [ON/OFF]   👤 人追跡 [開始]     │  ← カスタム能力（AI Toolkit 生成）
└─────────────────────────────────────────┘
```

カスタム能力の UI も AI Toolkit の Generate UI 機能で生成され、ベンダーは対話的に UI 要素を追加・削除・編集でき、産物は標準能力と同列である。

## 4. 連携と状態同期

コントロールが生成されると、その連携挙動はインターフェースプロトコルで定義され、**ベンダーが UI ロジックを書く必要はない**。処理関数はすべてベンダーの Lambda にあり、UI は「プロパティ値の描画 + 操作のプロトコルディレクティブへの翻訳」のみを行う。連携ロジックは 2 つに分かれる：**状態同期**と**イベント連携**。

### 4.1 状態同期：3 つのチャネル

UI とデバイス状態の同期メカニズム：

1. **読み取り**（ページを開いて初期値を取得）：Alexa App が `ReportState` ディレクティブを送信 → ベンダー Lambda が `StateReport` を返す（8s 以内、プロパティは namespace + instance を付ける）→ 各コントロールが対応する値で初期化
2. **書き込み**（ユーザー操作で新値を設定）：App が `SetRangeValue` などのディレクティブ（ヘッダーに instance を含む）を送信 → Lambda がデバイスを呼び出して実行 → `Alexa.Response`（context に新値を含む）を返す → コントロール更新
3. **プッシュ**（デバイス変化を能動的に報告）：デバイス状態が変化（物理操作 / 他クライアントの制御）→ Lambda が `ChangeReport`（3s 以内、変化したプロパティのみ）を送信 → App がプッシュ → コントロールがリアルタイム更新

タイミング：

```plaintext
① 読み取り ・ コントロールページを開く（ReportState → StateReport）
App ──ReportState──> Cloud ──> Lambda ──StateReport(8s以内)──> Cloud ──> App
                                                              （コントロール初期化）

② 書き込み ・ ユーザー操作（Directive → Response）
App ──SetRangeValue(instance)──> Cloud ──> Lambda ──> デバイス実行
App <──Response + 新状態───── Cloud <──Alexa.Response── Lambda
（スライダーが新値に更新）

③ プッシュ ・ デバイス状態変化（ChangeReport、いつでも発生しうる）
デバイス ──状態変化──> Lambda ──ChangeReport(3s以内)──> Cloud ──プッシュ──> App
                                                              （コントロールがリアルタイム更新）
```

`properties.retrievable` は初期値を取得できるか（読み取りチャネル）、`properties.proactivelyReported` はリアルタイム更新できるか（プッシュチャネル）を決める——これら 2 つのフラグは能力宣言時に設定しておく。

### 4.2 イベント連携：3 つのケース

コントロール上のイベントは処理箇所によって 3 種に分かれる：

| イベントドメイン     | 処理箇所                               | 例                                    |
| -------------------- | -------------------------------------- | ------------------------------------- |
| **アプリドメイン**   | App ローカル                           | ページ遷移、タブ切替、折りたたみ/展開 |
| **デバイスドメイン** | Lambda + プロトコル                    | モーション検知、スイッチ/PTZ 状態変化 |
| **混合ドメイン**     | App ローカル確認 → プロトコル → Lambda | 解除認証、プライバシーマスク確認      |

- **アプリドメインイベント（純ローカル）**：ページ遷移（ホーム→設定）、タブ切替、折りたたみ/展開、アニメーション、キャッシュ読み取りなど、App 自身のナビゲーション/UI ロジック。プロトコル層を経由せず、デバイス能力とは無関係。
- **デバイスドメインイベント（プロトコル経由）**：デバイス状態変化（物理操作 / 他クライアント制御）→ デバイス側が `ChangeReport` を送信 → UI 更新。
- **混合ドメインイベント（ローカル確認ののちプロトコル経由）**：安全確認が必要な操作。典型例、スマートロック解除：

```plaintext
ユーザー "unlock the front door" と発話
    → App 層：4 桁の音声コード入力を要求（ローカル認証、「人間向けの確認」）
    → 通過 → Alexa.LockController.Unlock ディレクティブを送信
    → Lambda 層：token 権限を検証（サーバー側認証、「真の検査」）
        通過 → 実行 → Alexa.Response + 状態スナップショット
        拒否 → Alexa.ErrorResponse → UI エラー表示
```

認証は**二層**：App 層が連携確認を、Lambda 層がサーバー側検証を行う。カメラのシーンも同様：プライバシーマスク前に二次確認、プライバシーモード中は PTZ 操作が拒否される。

## 5. 公開

能力宣言とコントロール UI 生成が完了すると、デバイスは公開フローに入る：

1. **審査**：Amazon がデバイス能力、セマンティック記述、UI を審査し、Alexa UX ガイドラインへの適合を確認する
2. **公開パラメータ**：AI Toolkit の Chat & Build / Upload Specification は能力記述の生成と同時に、公開に必要な公開パラメータ、NLU マッチングコーパス、App コントロール UI 設定、国際化文案を生成する
3. **認証**：標準能力は WWA（Works with Alexa）認証に通す必要がある。AI Toolkit で追加したカスタム能力は既存の WWA 範囲を再利用し、再認証は不要
4. **公開**：審査通過後に Alexa App で公開され、ユーザーがデバイスを発見・制御できるようになる

## 6. その他の接入パスの展開

### 6.1 Category SDK

Category SDK は生活サービスカテゴリ向けの標準化接入フレームワークで、6 つのカテゴリをサポートする：

| カテゴリ                | 説明           | 接入パス      |
| ----------------------- | -------------- | ------------- |
| Food ordering           | 食事注文       | Action（SPI） |
| Home services           | ハウスサービス | Action（SPI） |
| Local booking           | ローカル予約   | Action（SPI） |
| Restaurant reservations | レストラン予約 | Action（SPI） |
| Ride booking            | ライド予約     | **MCP のみ**  |
| Ticketing               | チケット購入   | Action（SPI） |

Category SDK は 2 つのサブパスを提供する：

- **Category Action Add-on**：SPI（Service Provider Interface）契約でベンダー API を接続。低遅延、強靭性、成熟した API を持つパートナー向け
- **Category MCP Add-on**：標準 MCP プロトコルでベンダーの MCP server を接続。既に MCP server を持つ、または同標準を好むパートナー向け

Ride booking は MCP でのみ接入可能で、SPI は使えない点に注意。開発者ワークフローは：実装/デプロイ（Alexa AI CLI + AWS）→ テスト（Web シミュレータ + E2E デバイステスト）→ 公開（認証 → 公開 → 監視）。

### 6.2 MCP Toolkit

MCP Toolkit は任意のプロバイダーが既存の MCP server を Alexa+ に接入できるようにし、顧客は音声とビジュアル連携でそれらの能力を利用できる。

**アーキテクチャ**：ベンダーは MCP server（tools/resources/prompts を公開）+ Alexa+ MCP Add-on（MCP server と Alexa+ の橋渡し、プロトコル翻訳と能力登録を処理）+ Add-on レジストリ（tools を索引し、Alexa+ の AI 推論がいつ呼び出すかを決定）+ Orchestrator（体験を協調）をデプロイする。

**トランスポート**：Streamable HTTP（stdio / WebSocket は非対応）。2025-11-25 版 MCP 仕様に準拠し、MCP Apps 拡張（会話ビュー内に地図、マルチステップフロー、ダッシュボードなどのインタラクティブ UI をインライン描画）をサポートする。

**接入方式**：add-on Agent Skill（agentic onboarding）または Alexa AI CLI でセルフサービス接入し、Alexa+ が MCP server を検査、統合パスを提案、シミュレータ対応のパッケージを納品する。Tool の変更は `alexa-ai deploy` で再デプロイが必要。

**認証：二層 OAuth 2.0**：

| 階層   | Grant Type                  | 用途                                                                                                                                             | ユーザー関与 |
| ------ | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ |
| Tier 1 | `client_credentials`        | サービスレベルの M2M 認証。プライベート MCP server の登録/ヘルスチェック、ツール発見（`initialize`、`tools/list`）、非ユーザーデータの照会に使用 | なし         |
| Tier 2 | `authorization_code` + PKCE | ユーザーレベルの認証と同意。ユーザー固有の tool 実行、ユーザーリソースへのアクセスに使用                                                         | あり         |

- Tier 1 のトークンは短命（推奨 ≤ 3600s）、**refresh_token は発行されず**、期限切れごとに再リクエスト。scope は `mcp:service`
- Tier 2 の scope は `mcp:tools` / `mcp:resources`
- Dynamic Client Registration（DCR）、OpenID Connect（OIDC）、Step-Up Authorization は非対応
- 認証属性がサーバー側で変更された場合、MCP Add-on を再デプロイする必要がある（Alexa+ は再デプロイまで値をキャッシュする）

MCP Toolkit は現在米国でのみ利用可能。

## おわりに

Alexa デバイス接入の中核の流れは「能力宣言 → コントロール UI 生成 → 連携・状態同期 → 公開」である。従来の Smart Home メカニズム（Discover.Response、Capability Interfaces、StateReport/ChangeReport）が標準能力の接入を担う一方、Alexa+ の Smart Home AI Toolkit は AI セマンティック記述レイヤーによって能力露出の範囲を定義済みインターフェースから任意のカスタム機能へと拡張した——これが Alexa+ の最も重要な増分である。

その上に、Category SDK は同一の AI Agent フレームワークを生活サービスカテゴリへ拡張し、MCP Toolkit はオープンプロトコルで AI Agent エコシステム全体へ接入する。3 つすべてに共通するのは AI-first という特徴で、開発者は手書きのインターフェースコードを自然言語とドキュメントで置き換え、LLM がランタイムで意図理解とパラメータ推論を担う。

## 付録 A：用語対照

| 用語                           | フルネーム / 説明                                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| **ASK**                        | Alexa Skills Kit、Alexa スキル開発ツールセット                                                                |
| **AVS**                        | Alexa Voice Service、Alexa をサードパーティハードウェアに組み込むサービス                                     |
| **ACK**                        | Alexa Connect Kit、Skill もクラウドも不要な全面管理型デバイス接入ソリューション                               |
| **Smart Home Add-on**          | 旧 Smart Home Skill、Capability Interfaces に基づくデバイス接入                                               |
| **Smart Home AI Toolkit**      | Alexa+ で追加、AI セマンティック化された能力露出（Preview）。公式名 _AI-powered smart home developer toolkit_ |
| **Action Controller**          | Smart Home AI Toolkit の新コントローラ、名前付きアクションをトリガー                                          |
| **Dynamic Controller**         | Smart Home AI Toolkit の新コントローラ、動的パラメータ組み合わせを露出                                        |
| **Category SDK**               | 6 カテゴリの標準化接入フレームワーク（Preview）                                                               |
| **MCP**                        | Model Context Protocol、AI モデルと外部ツールが連携するオープン標準プロトコル                                 |
| **MCP Toolkit**                | Alexa+ の MCP ベースの汎用サービス接入ツールセット                                                            |
| **Capability Interfaces**      | Alexa Smart Home の標準能力インターフェース体系                                                               |
| **WWA**                        | Works with Alexa、デバイス制御認証                                                                            |
| **SPI**                        | Service Provider Interface、Category SDK の契約型インターフェース                                             |
| **Discover.Response**          | デバイス発見フェーズで返される能力宣言構造                                                                    |
| **StateReport / ChangeReport** | 状態報告の 2 種のメッセージ：全量照会 / 差分プッシュ                                                          |

## 付録 B：公式ドキュメント索引

本記事で参照した Amazon 公式ドキュメントの入り口を、本文のトピック順に列挙する。章ごとに深く調べたいときに参照すること：

| ドキュメント                        | リンク                                                                                             |
| ----------------------------------- | -------------------------------------------------------------------------------------------------- |
| Alexa 開発者ポータル                | <https://developer.amazon.com/en-US/alexa>                                                         |
| ASK エントリポイント                | <https://developer.amazon.com/en-US/alexa/alexa-skills-kit>                                        |
| Smart Home 開発オプション           | <https://developer.amazon.com/en-US/docs/alexa/smarthome/development-options.html>                 |
| Capability Interfaces 完全索引      | <https://developer.amazon.com/en-US/docs/alexa/device-apis/alexa-interface.html>                   |
| ACK 概要                            | <https://developer.amazon.com/en-US/docs/alexa/ack/>                                               |
| Alexa+ for Builders ホーム          | <https://developer.amazon.com/en-US/docs/alexaplus/add-ons/>                                       |
| Alexa+ MCP Toolkit 概要             | <https://developer.amazon.com/en-US/docs/alexaplus/add-ons/mcp-toolkit-overview.html>              |
| Alexa+ MCP 認証（二層 OAuth 2.0）   | <https://developer.amazon.com/en-US/docs/alexaplus/add-ons/mcp-toolkit-authentication.html>        |
| Category SDK 概要                   | <https://developer.amazon.com/en-US/docs/alexaplus/add-ons/overview-category-sdk.html>             |
| 2026 Partner Summit ブログ          | <https://developer.amazon.com/zh/alexaplus/blogs/2026/07/alexa-plus-new-ways-to-build-experiences> |
| AI-native SDKs for Alexa+（2025.2） | <https://developer.amazon.com/en-US/blogs/alexa/alexa-skills-kit/2025/02/new-alexa-announce-blog>  |
| Alexa+ 公式発表                     | <https://www.aboutamazon.com/news/devices/new-alexa-tech-generative-artificial-intelligence>       |
