"use client";

import { useState, useEffect } from "react";
// 【注釈】外部ファイルからデータを読み込みます。
// これにより、データとプログラムの見た目を分けて管理しやすくなります。
import { DUNGEON_LIST, GLOBAL_LIST, LANDSCAPE_DATA, Dungeon } from "../constants/dungeonData";
import { getAllScamperCards, ScamperCard } from "../constants/scamperCards";

/**
 * 【注釈】interface: データの「形」を定義する仕組みです。
 * TypeScriptという言語を使い、データの構造をあらかじめ決めておきます。
 */

// お題（テーマ）の型定義
interface Theme {
  subject: string;    // 主題（何を描くか）
  atmosphere: string; // 雰囲気（どんな感じか）
  element: string;    // 要素（何が含まれるか）
}

/**
 * 【注釈】Landscape: 新しい機能「風景探索」用のお題データです。
 * 場所、主役、現象の3つの要素を組み合わせて風景を作ります。
 */
interface Landscape {
  location: string;    // 場所
  protagonist: string; // 主役
  phenomenon: string;  // 現象
}

// 画面遷移用の型定義
type View = "home" | "daily" | "weekly" | "boss" | "atlas";

// 週クエスト（新しいアイデア）の型定義
interface WeeklyIdea {
  id: string;
  sourceId: string;    // 元になったアイデア/風景のID
  sourceType: "idea" | "map"; // 元のデータの種類
  sourceContent: string; // 元の内容（表示用）
  content: string;     // 発展させたアイデア
  hints: string[];     // 使用した2つのヒント
  rating: number;      // 星 (0-3)
  date: string;        // 保存日時
}

// アイデアの型定義
interface Idea {
  id: string;         // 一意のID
  content: string;    // アイデアの内容（1つずつ保存）
  rating: number;     // 星の数 (0-3)
  scamper: string;    // このアイデアに使ったヒント
  scamperDescription?: string; // ヒントの説明文（カテゴリ）
  date: string;       // 保存日時
  theme: Theme;      // その時使ったお題
  tags: string[];    // 【追加】タグ機能
}

/**
 * 【注釈】MapEntry: 「風景探索」でユーザーが入力した記録の型定義です。
 * お題に加えて、見えるもの、起きていること、雰囲気を保存します。
 */
interface MapEntry {
  id: string;
  landscape: Landscape; // 使用したお題
  visuals: string;      // 見えるもの
  events: string;       // 起きていること
  atmosphere: string;   // 雰囲気
  rating: number;       // 評価 (0-3)
  date: string;         // 保存日時
  tags: string[];       // 【追加】タグ機能
}

/**
 * 【注釈】UserProfile: ユーザーの成長や進行状況を管理する型です。
 * 今後のレベルアップ機能やエリア解放（アンロック）の基盤となります。
 */
interface UserProfile {
  level: number;
  unlockedDungeons: string[]; // 解放済みのダンジョンID
}

// 初期データの定義（お題のパーツ）
const SUBJECTS = ["静かな港", "忘れられた時計塔", "空飛ぶ島", "地下都市の酒場", "巨獣の背中の村"];
const ATMOSPHERES = ["幻想的", "退廃的", "活気ある", "神秘的", "不気味な"];
const ELEMENTS = ["青い炎", "輝く歯車", "巨大な鎖", "透明な花", "空を泳ぐ魚"];


export default function Home() {
  // --- 状態管理 (useState) ---
  /**
   * 【注釈】activeView: 現在どの画面を表示しているかを管理します。
   * これを切り替えることで、アプリ内の「ページ遷移」を表現します。
   */
  const [activeView, setActiveView] = useState<View>("home");
  
  // デイリークエスト内でのタブ切り替え ("dungeon" | "landscape")
  const [dailyTab, setDailyTab] = useState<"dungeon" | "landscape">("dungeon");

  // --- データの保持 (localStorageから読み込む) ---
  const [ideaList, setIdeaList] = useState<Idea[]>([]);
  const [mapList, setMapList] = useState<MapEntry[]>([]);
  const [weeklyIdeaList, setWeeklyIdeaList] = useState<WeeklyIdea[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile>({ level: 1, unlockedDungeons: [DUNGEON_LIST[0].id] });

  // --- デイリー：ダンジョン探索の状態 ---
  const [selectedDungeonId, setSelectedDungeonId] = useState<string>(DUNGEON_LIST[0].id);
  const [currentTheme, setCurrentTheme] = useState<Theme | null>(null);
  const [inputs, setInputs] = useState<string[]>(["", "", ""]);
  const [inputTags, setInputTags] = useState<string[]>(["", "", ""]); // 【追加】タグ入力用
  const [hints, setHints] = useState<ScamperCard[]>([]);
  const [ratings, setRatings] = useState<number[]>([0, 0, 0]);

  // --- デイリー：風景探索の状態 ---
  const [selectedLocation, setSelectedLocation] = useState<string>(LANDSCAPE_DATA.places[0]);
  const [currentLandscape, setCurrentLandscape] = useState<Landscape | null>(null);
  const [mapInput, setMapInput] = useState({
    visuals: "",
    events: "",
    atmosphere: "",
    tags: "" // 【追加】タグ入力用
  });
  const [mapRating, setMapRating] = useState(0);

  // --- 週クエストの状態 ---
  const [weeklySource, setWeeklySource] = useState<{ id: string, type: "idea" | "map", content: string } | null>(null);
  const [weeklyHints, setWeeklyHints] = useState<ScamperCard[]>([]);
  const [weeklyInput, setWeeklyInput] = useState("");
  const [weeklyRating, setWeeklyRating] = useState(0);

  // --- 図鑑（Atlas）の操作ロジック ---
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    content?: string;
    visuals?: string;
    events?: string;
    atmosphere?: string;
    rating: number;
    tags: string; // カンマ区切りの文字列として編集
  } | null>(null);

  // 【追加】図鑑のフィルタリング用
  const [tagFilter, setTagFilter] = useState<string>("");

  /**
   * 【注釈】削除（filter）のロジック:
   * filter() メソッドは、条件に「合致しないもの」を除外した新しい配列を作成します。
   * ここでは「選んだIDと一致しないデータだけを残す」ことで削除を実現しています。
   */
  const handleDeleteIdea = (id: string) => {
    if (confirm("このアイデアを削除してもよろしいですか？")) {
      const newList = ideaList.filter(item => item.id !== id);
      setIdeaList(newList);
      saveToLocalStorage("landscape_atlas_ideas", newList);
    }
  };

  const handleDeleteMap = (id: string) => {
    if (confirm("この風景を削除してもよろしいですか？")) {
      const newList = mapList.filter(item => item.id !== id);
      setMapList(newList);
      saveToLocalStorage("landscape_atlas_maps", newList);
    }
  };

  const handleDeleteWeekly = (id: string) => {
    if (confirm("この記録を削除してもよろしいですか？")) {
      const newList = weeklyIdeaList.filter(item => item.id !== id);
      setWeeklyIdeaList(newList);
      saveToLocalStorage("landscape_atlas_weekly", newList);
    }
  };

  /**
   * 【注釈】編集（map）のロジック:
   * map() メソッドは、配列の全要素を一つずつ確認して新しい配列を作ります。
   * 編集したいIDを見つけた時だけ「書き換えたデータ」を返し、それ以外は「元のデータ」をそのまま返します。
   */
  const startEditIdea = (idea: Idea) => {
    setEditingId(idea.id);
    /**
     * 【注釈】オプショナルチェイニング (?.) :
     * データの後に ?. をつけることで、もしそのデータが空（nullやundefined）だったとしても
     * プログラムが止まらずに「空ですよ」という結果を返してくれる魔法の書き方です。
     * ここでは、古いデータで tags が存在しない場合に備えて使用しています。
     */
    setEditForm({ 
      content: idea.content, 
      rating: idea.rating,
      tags: (idea.tags || []).join(", ")
    });
  };

  const startEditMap = (entry: MapEntry) => {
    setEditingId(entry.id);
    setEditForm({ 
      visuals: entry.visuals, 
      events: entry.events, 
      atmosphere: entry.atmosphere, 
      rating: entry.rating,
      tags: (entry.tags || []).join(", ")
    });
  };

  const startEditWeekly = (idea: WeeklyIdea) => {
    setEditingId(idea.id);
    setEditForm({ 
      content: idea.content, 
      rating: idea.rating,
      tags: "" // 週クエストにはタグがまだないので空
    });
  };

  const handleSaveEditIdea = () => {
    if (!editingId || !editForm) return;
    const newTags = editForm.tags.split(",").map(t => t.trim()).filter(t => t !== "");
    const newList = ideaList.map(item => 
      item.id === editingId ? { 
        ...item, 
        content: editForm.content || "", 
        rating: editForm.rating,
        tags: newTags
      } : item
    );
    setIdeaList(newList);
    saveToLocalStorage("landscape_atlas_ideas", newList);
    setEditingId(null);
    setEditForm(null);
  };

  const handleSaveEditMap = () => {
    if (!editingId || !editForm) return;
    const newTags = editForm.tags.split(",").map(t => t.trim()).filter(t => t !== "");
    const newList = mapList.map(item => 
      item.id === editingId ? { 
        ...item, 
        visuals: editForm.visuals || "", 
        events: editForm.events || "", 
        atmosphere: editForm.atmosphere || "", 
        rating: editForm.rating,
        tags: newTags
      } : item
    );
    setMapList(newList);
    saveToLocalStorage("landscape_atlas_maps", newList);
    setEditingId(null);
    setEditForm(null);
  };

  const handleSaveEditWeekly = () => {
    if (!editingId || !editForm) return;
    const newList = weeklyIdeaList.map(item => 
      item.id === editingId ? { ...item, content: editForm.content || "", rating: editForm.rating } : item
    );
    setWeeklyIdeaList(newList);
    saveToLocalStorage("landscape_atlas_weekly", newList);
    setEditingId(null);
    setEditForm(null);
  };

  // --- 演出用の状態 ---
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [isProcessing, setIsProcessing] = useState(false); // 保存中（連打防止用）

  // --- サイドエフェクト (useEffect) ---
  useEffect(() => {
    // 保存されたデータの読み込み
    // 【注釈】古いデータ（tagsがない）を読み込んだ時にエラーにならないよう、mapで補完します。
    const savedIdeas = localStorage.getItem("landscape_atlas_ideas");
    if (savedIdeas) {
      const parsed = JSON.parse(savedIdeas);
      setIdeaList(parsed.map((item: any) => ({ ...item, tags: item.tags || [] })));
    }

    const savedMaps = localStorage.getItem("landscape_atlas_maps");
    if (savedMaps) {
      const parsed = JSON.parse(savedMaps);
      setMapList(parsed.map((item: any) => ({ ...item, tags: item.tags || [] })));
    }

    const savedWeekly = localStorage.getItem("landscape_atlas_weekly");
    if (savedWeekly) setWeeklyIdeaList(JSON.parse(savedWeekly));

    const savedProfile = localStorage.getItem("landscape_atlas_profile");
    if (savedProfile) {
      setUserProfile(JSON.parse(savedProfile));
    } else {
      // 初回起動時の初期化
      saveToLocalStorage("landscape_atlas_profile", { level: 1, unlockedDungeons: [DUNGEON_LIST[0].id] });
    }
  }, []);

  // データを保存する共通関数
  const saveToLocalStorage = (key: string, data: any) => {
    localStorage.setItem(key, JSON.stringify(data));
  };

  // --- 週クエストのロジック ---
  const handleStartWeekly = () => {
    // 既存のアイデアと風景からランダムに選ぶ
    const allSources: { id: string, type: "idea" | "map", content: string }[] = [
      ...ideaList.map(i => ({ id: i.id, type: "idea" as const, content: i.content })),
      ...mapList.map(m => ({ id: m.id, type: "map" as const, content: `${m.landscape.location}での出来事: ${m.events}` }))
    ];

    if (allSources.length === 0) {
      alert("週クエストを始めるには、まずデイリークエストでいくつかのアイデアや風景を保存してください！");
      return;
    }

    const source = allSources[Math.floor(Math.random() * allSources.length)];
    setWeeklySource(source);

    // ヒントを2つ抽選
    const allCards = getAllScamperCards();
    const shuffled = [...allCards].sort(() => Math.random() - 0.5);
    const selectedHints = shuffled.slice(0, 2);

    setWeeklyHints(selectedHints);
    setWeeklyInput("");
    setWeeklyRating(0);
    setActiveView("weekly");
  };

  const handleSaveWeekly = () => {
    if (!weeklySource || !weeklyInput.trim()) {
      alert("アイデアを入力してください。");
      return;
    }

    // 保存処理を開始（連打防止）
    setIsProcessing(true);

    const newWeekly: WeeklyIdea = {
      id: Date.now().toString(),
      sourceId: weeklySource.id,
      sourceType: weeklySource.type,
      sourceContent: weeklySource.content,
      content: weeklyInput,
      hints: weeklyHints.map(h => `${h.text} (${h.categoryLabel})`),
      rating: weeklyRating,
      date: new Date().toLocaleString("ja-JP")
    };

    const newList = [newWeekly, ...weeklyIdeaList];
    setWeeklyIdeaList(newList);
    saveToLocalStorage("landscape_atlas_weekly", newList);

    // 演出の表示
    setToastMessage("錬成手帳に記録しました");
    setShowToast(true);

    // タイマー処理（非同期処理）
    setTimeout(() => {
      setShowToast(false);
      setIsProcessing(false);
      // 自動遷移
      setActiveView("home");
    }, 1500);
  };

  // --- ダンジョン探索（お題を引く）の処理 ---
  const handleExplore = () => {
    // 【注釈】選択されたダンジョンのデータを取得します。
    const dungeon = DUNGEON_LIST.find(d => d.id === selectedDungeonId) || DUNGEON_LIST[0];

    // 【注釈】5:5の確率で専用リストか全体リストから選ぶ関数です。
    const getRandomItem = (specificList: string[], globalList: string[]) => {
      // Math.random() は 0以上1未満の数字を返します。
      // 0.5 未満（50%の確率）なら専用リスト、そうでなければ全体リストから選びます。
      const list = Math.random() < 0.5 ? specificList : globalList;
      return list[Math.floor(Math.random() * list.length)];
    };

    // お題（テーマ）を決定
    const newTheme: Theme = {
      // 主題と要素は 5:5 の確率で抽選
      subject: getRandomItem(dungeon.subjects, GLOBAL_LIST.subjects),
      // 雰囲気はステージ固定（専用リストからのみ）で抽選
      atmosphere: dungeon.atmospheres[Math.floor(Math.random() * dungeon.atmospheres.length)],
      element: getRandomItem(dungeon.elements, GLOBAL_LIST.elements),
    };
    setCurrentTheme(newTheme);

    /**
     * 【注釈】重複なしで3枚のカードを選ぶロジック
     * 1. getAllScamperCards() で全てのカードを取得します。
     * 2. filter() を使うことで、将来的に「特定のカテゴリのみ」や「アンロック済み」に絞り込みやすくしています。
     * 3. sort(() => Math.random() - 0.5) で配列をランダムにシャッフルします。
     * 4. slice(0, 3) でシャッフルされた配列の先頭3つを取り出します。
     * これにより、確実に重複のない3枚を抽出できます。
     */
    const allCards = getAllScamperCards();
    const availableCards = allCards.filter(card => true); // 将来のアンロック条件などをここに記述
    
    const shuffled = [...availableCards].sort(() => Math.random() - 0.5);
    const newHints = shuffled.slice(0, 3);
    
    setHints(newHints);
  };

  // 入力フォームの変更処理
  const handleInputChange = (index: number, value: string) => {
    const newInputs = [...inputs];
    newInputs[index] = value;
    setInputs(newInputs);
  };

  const handleTagInputChange = (index: number, value: string) => {
    const newTags = [...inputTags];
    newTags[index] = value;
    setInputTags(newTags);
  };

  // 評価（星）の変更処理
  const handleRatingChange = (index: number, value: number) => {
    const newRatings = [...ratings];
    newRatings[index] = value;
    setRatings(newRatings);
  };

  // 「採掘完了（保存）」ボタンの処理
  const handleSave = () => {
    if (!currentTheme) {
      alert("まずは「探索」してお題を引いてください！");
      return;
    }
    
    // 入力があるものだけを抽出して、それぞれ独立したIdeaオブジェクトにする
    const newIdeas: Idea[] = [];
    
    // 現在のダンジョン名を取得
    const dungeon = DUNGEON_LIST.find(d => d.id === selectedDungeonId);
    const dungeonName = dungeon ? dungeon.name : "";

    /**
     * 【注釈】mapやforEachでのループ処理:
     * 3つの入力欄を一つずつチェックし、空欄でない場合のみ保存用データを作成します。
     */
    inputs.forEach((content, i) => {
      if (content.trim() !== "") {
        // ユーザーが入力したタグをカンマで分割して配列にする
        const userTags = inputTags[i].split(",").map(t => t.trim()).filter(t => t !== "");
        // ダンジョン名を自動的にタグに含める
        const allTags = dungeonName ? [dungeonName, ...userTags] : userTags;

        newIdeas.push({
          id: `${Date.now()}-${i}`, // 重複を避けるためのID
          content: content,
          rating: ratings[i],
          scamper: hints[i].text,
          scamperDescription: hints[i].categoryLabel,
          date: new Date().toLocaleString("ja-JP"),
          theme: currentTheme,
          tags: allTags,
        });
      }
    });

    if (newIdeas.length === 0) {
      alert("アイデアを何か1つは入力してください。");
      return;
    }

    // 保存処理を開始（連打防止）
    setIsProcessing(true);

    const newList = [...newIdeas, ...ideaList];
    setIdeaList(newList);
    saveToLocalStorage("landscape_atlas_ideas", newList);

    // 演出の表示
    setToastMessage("グリッチを記録しました！");
    setShowToast(true);

    /**
     * 【注釈】非同期処理（タイマー処理）の書き方:
     * setTimeout(() => { ... }, 時間) は、指定した時間が経過した後に
     * 中身のプログラムを実行する命令です。
     * ここでは 1500ミリ秒（1.5秒）待ってから、画面をホームに戻す処理を行っています。
     * これにより、ユーザーが「登録完了」のメッセージを確認する時間を確保できます。
     */
    setTimeout(() => {
      setShowToast(false);
      setIsProcessing(false);
      // フォームをリセット
      setInputs(["", "", ""]);
      setRatings([0, 0, 0]);
      // 自動遷移
      setActiveView("home");
    }, 1500);
  };

  // --- 風景探索（Landscape）の処理 ---
  // 「風景を探索する」ボタンの処理
  const handleExploreLandscape = () => {
    // 【注釈】風景探索は新しいリストから完全ランダムに組み合わせます。
    const newLandscape: Landscape = {
      location: selectedLocation, // 選択された場所を固定
      protagonist: LANDSCAPE_DATA.protagonists[Math.floor(Math.random() * LANDSCAPE_DATA.protagonists.length)],
      phenomenon: LANDSCAPE_DATA.phenomena[Math.floor(Math.random() * LANDSCAPE_DATA.phenomena.length)],
    };
    setCurrentLandscape(newLandscape);
    // 入力をクリア
    setMapInput({ visuals: "", events: "", atmosphere: "", tags: "" });
    setMapRating(0);
  };

  // 風景の保存処理
  const handleSaveMap = () => {
    if (!currentLandscape) {
      alert("まずは風景を探索してください！");
      return;
    }
    if (!mapInput.visuals || !mapInput.events || !mapInput.atmosphere) {
      alert("すべての項目を入力してください。");
      return;
    }

    // 保存処理を開始（連打防止）
    setIsProcessing(true);

    // ユーザー入力のタグを処理
    const userTags = mapInput.tags.split(",").map(t => t.trim()).filter(t => t !== "");
    // 場所の名前を自動的にタグに含める
    const allTags = [currentLandscape.location, ...userTags];

    const newEntry: MapEntry = {
      id: Date.now().toString(),
      landscape: currentLandscape,
      visuals: mapInput.visuals,
      events: mapInput.events,
      atmosphere: mapInput.atmosphere,
      rating: mapRating,
      date: new Date().toLocaleString("ja-JP"),
      tags: allTags,
    };

    const newList = [newEntry, ...mapList];
    setMapList(newList);
    saveToLocalStorage("landscape_atlas_maps", newList);

    // 演出の表示
    setToastMessage("マップに登録しました！");
    setShowToast(true);

    // タイマー処理（非同期処理）
    setTimeout(() => {
      setShowToast(false);
      setIsProcessing(false);
      // フォームをリセット
      setCurrentLandscape(null);
      setMapInput({ visuals: "", events: "", atmosphere: "", tags: "" });
      setMapRating(0);
      // 自動遷移
      setActiveView("home");
    }, 1500);
  };

  return (
    <main className="rpg-container">
      <h1 onClick={() => setActiveView("home")} className="main-title">『グリッチ（Gri-Sketch）』</h1>
      
      {/* 
        【注釈】条件分岐による画面切り替え:
        activeView の値によって、表示するコンポーネントを切り替えています。
        これはSPA（シングルページアプリケーション）の基本的な仕組みです。
      */}

      {activeView === "home" && (
        <div className="home-menu">
          <p style={{ textAlign: "center", marginBottom: "30px" }}>
            〜 冒険の準備を整えるギルドの拠点 〜
          </p>
          <div style={{ display: "grid", gap: "15px", maxWidth: "400px", margin: "0 auto" }}>
            <button className="rpg-button primary" onClick={() => setActiveView("daily")}>
              ⚔️ デイリークエスト
            </button>
            <button className="rpg-button primary" onClick={handleStartWeekly}>
              📜 週クエスト
            </button>
            <button className="rpg-button" onClick={() => setActiveView("boss")} style={{ backgroundColor: "#7f8c8d" }}>
              👹 月ボス (Coming Soon)
            </button>
            <button className="rpg-button secondary" onClick={() => { setTagFilter(""); setActiveView("atlas"); }}>
              📖 図鑑・マップ
            </button>
          </div>
        </div>
      )}

      {activeView === "daily" && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <button className="rpg-button" onClick={() => setActiveView("home")} style={{ width: "auto", padding: "5px 15px" }}>
              ◀ 拠点に戻る
            </button>
            <h2 style={{ margin: 0 }}>デイリークエスト</h2>
          </div>

          <div style={{ 
            display: "flex", 
            justifyContent: "center", 
            gap: "10px", 
            marginBottom: "30px" 
          }}>
            <button 
              className={`rpg-button ${dailyTab === "dungeon" ? "active" : ""}`}
              onClick={() => setDailyTab("dungeon")}
              style={{ 
                flex: 1, 
                maxWidth: "200px",
                backgroundColor: dailyTab === "dungeon" ? "#2c3e50" : "#95a5a6" 
              }}
            >
              🏰 ダンジョン探索
            </button>
            <button 
              className={`rpg-button ${dailyTab === "landscape" ? "active" : ""}`}
              onClick={() => setDailyTab("landscape")}
              style={{ 
                flex: 1, 
                maxWidth: "200px",
                backgroundColor: dailyTab === "landscape" ? "#2c3e50" : "#95a5a6" 
              }}
            >
              🗺️ 風景探索
            </button>
          </div>

          {dailyTab === "dungeon" ? (
            <div className="dungeon-section">
              <section className="rpg-box">
                <div className="rpg-title">探索の書</div>
                <div style={{ margin: "15px 0" }}>
                  <label style={{ display: "block", fontSize: "0.9rem", fontWeight: "bold", marginBottom: "8px" }}>
                    探索するダンジョンを選択：
                  </label>
                  <select 
                    className="rpg-input" 
                    value={selectedDungeonId}
                    onChange={(e) => setSelectedDungeonId(e.target.value)}
                    style={{ marginBottom: "15px", cursor: "pointer" }}
                  >
                    {DUNGEON_LIST.map(dungeon => (
                      <option key={dungeon.id} value={dungeon.id}>
                        {dungeon.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ margin: "15px 0", minHeight: "80px" }}>
                  {currentTheme ? (
                    <div>
                      <p><strong>主題：</strong> {currentTheme.subject}</p>
                      <p><strong>雰囲気：</strong> {currentTheme.atmosphere}</p>
                      <p><strong>要素：</strong> {currentTheme.element}</p>
                    </div>
                  ) : (
                    <p style={{ color: "#666" }}>「探索」ボタンを押して、お題を受け取ってください。</p>
                  )}
                </div>
                <button className="rpg-button" onClick={handleExplore}>
                  {currentTheme ? "別のお題を探す" : "探索を開始する"}
                </button>
              </section>

              <section className="rpg-box">
                <div className="rpg-title">アイデアの採掘</div>
                <div style={{ marginTop: "15px" }}>
                  {inputs.map((val, i) => (
                    <div key={i} style={{ 
                      marginBottom: "20px", 
                      padding: "10px", 
                      border: "1px solid #eee", 
                      borderRadius: "8px",
                      backgroundColor: "rgba(255,255,255,0.5)"
                    }}>
                      <div style={{ marginBottom: "5px" }}>
                        <span style={{ fontSize: "0.85rem", color: "#d35400", fontWeight: "bold" }}>
                          ヒント: {hints[i]?.text || "（探索してください）"}
                        </span>
                        {hints[i] && (
                          <span style={{ 
                            marginLeft: "10px", 
                            fontSize: "0.75rem", 
                            color: "#7f8c8d",
                            backgroundColor: "#ecf0f1",
                            padding: "2px 6px",
                            borderRadius: "4px"
                          }}>
                            {hints[i].categoryLabel}
                          </span>
                        )}
                      </div>
                      <input
                        className="rpg-input"
                        type="text"
                        placeholder={`アイデアを入力...`}
                        value={val}
                        onChange={(e) => handleInputChange(i, e.target.value)}
                      />
                      <input
                        className="rpg-input"
                        type="text"
                        placeholder="タグをカンマ区切りで入力（例: エモい, メカ）"
                        value={inputTags[i]}
                        onChange={(e) => handleTagInputChange(i, e.target.value)}
                        style={{ marginTop: "5px", fontSize: "0.85rem" }}
                      />
                      <div className="star-rating" style={{ marginTop: "5px" }}>
                        {[1, 2, 3].map((star) => (
                          <span
                            key={star}
                            className={`star ${ratings[i] >= star ? "active" : ""}`}
                            onClick={() => handleRatingChange(i, star)}
                          >
                            ★
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <button 
                  className="rpg-button" 
                  onClick={handleSave}
                  disabled={isProcessing}
                  style={{ opacity: isProcessing ? 0.7 : 1, cursor: isProcessing ? "not-allowed" : "pointer" }}
                >
                  {isProcessing ? "保存中..." : "採掘完了（保存）"}
                </button>
              </section>
            </div>
          ) : (
            <div className="landscape-section">
              <section className="rpg-box">
                <div className="rpg-title">風景の発見</div>
                <div style={{ margin: "15px 0" }}>
                  <label style={{ display: "block", fontSize: "0.9rem", fontWeight: "bold", marginBottom: "8px" }}>
                    探索する場所を選択：
                  </label>
                  <select 
                    className="rpg-input" 
                    value={selectedLocation}
                    onChange={(e) => setSelectedLocation(e.target.value)}
                    style={{ marginBottom: "15px", cursor: "pointer" }}
                  >
                    {LANDSCAPE_DATA.places.map((place, idx) => (
                      <option key={idx} value={place}>
                        {place}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ margin: "15px 0", minHeight: "80px" }}>
                  {currentLandscape ? (
                    <div style={{ textAlign: "center", fontSize: "1.2rem", lineHeight: "1.8" }}>
                      <p>あなたは <strong>{currentLandscape.location}</strong> にたどり着いた。</p>
                      <p>そこには <strong>{currentLandscape.protagonist}</strong> がいて、</p>
                      <p><strong>{currentLandscape.phenomenon}</strong> が起きていた。</p>
                    </div>
                  ) : (
                    <p style={{ color: "#666", textAlign: "center" }}>「風景を探索する」ボタンを押して、新たな景色を見つけましょう。</p>
                  )}
                </div>
                <button className="rpg-button" onClick={handleExploreLandscape}>
                  {currentLandscape ? "別の風景を探す" : "風景を探索する"}
                </button>
              </section>

              <section className="rpg-box">
                <div className="rpg-title">風景のスケッチ</div>
                <div style={{ marginTop: "15px" }}>
                  <div style={{ marginBottom: "15px" }}>
                    <label style={{ display: "block", fontSize: "0.9rem", fontWeight: "bold", marginBottom: "5px" }}>見えるもの</label>
                    <textarea 
                      className="rpg-input" 
                      rows={2}
                      placeholder="どんな景色、色、造形が見えますか？"
                      value={mapInput.visuals}
                      onChange={(e) => setMapInput({...mapInput, visuals: e.target.value})}
                      style={{ width: "100%", padding: "10px", resize: "none" }}
                    />
                  </div>
                  <div style={{ marginBottom: "15px" }}>
                    <label style={{ display: "block", fontSize: "0.9rem", fontWeight: "bold", marginBottom: "5px" }}>起きていること</label>
                    <textarea 
                      className="rpg-input" 
                      rows={2}
                      placeholder="主役は何をしていますか？"
                      value={mapInput.events}
                      onChange={(e) => setMapInput({...mapInput, events: e.target.value})}
                      style={{ width: "100%", padding: "10px", resize: "none" }}
                    />
                  </div>
                  <div style={{ marginBottom: "15px" }}>
                    <label style={{ display: "block", fontSize: "0.9rem", fontWeight: "bold", marginBottom: "5px" }}>雰囲気</label>
                    <textarea 
                      className="rpg-input" 
                      rows={2}
                      placeholder="その場所にはどんな空気が流れていますか？"
                      value={mapInput.atmosphere}
                      onChange={(e) => setMapInput({...mapInput, atmosphere: e.target.value})}
                      style={{ width: "100%", padding: "10px", resize: "none" }}
                    />
                  </div>
                  <div style={{ marginBottom: "15px" }}>
                    <label style={{ display: "block", fontSize: "0.9rem", fontWeight: "bold", marginBottom: "5px" }}>タグ</label>
                    <input 
                      className="rpg-input" 
                      type="text"
                      placeholder="カンマ区切りで入力（例: 幻想的, 廃墟）"
                      value={mapInput.tags}
                      onChange={(e) => setMapInput({...mapInput, tags: e.target.value})}
                      style={{ width: "100%", padding: "10px" }}
                    />
                  </div>
                  <div style={{ marginBottom: "15px" }}>
                    <div className="star-rating">
                      {[1, 2, 3].map((star) => (
                        <span
                          key={star}
                          className={`star ${mapRating >= star ? "active" : ""}`}
                          onClick={() => setMapRating(star)}
                        >
                          ★
                        </span>
                      ))}
                    </div>
                  </div>
                  <button 
                    className="rpg-button" 
                    onClick={handleSaveMap}
                    disabled={isProcessing}
                    style={{ opacity: isProcessing ? 0.7 : 1, cursor: isProcessing ? "not-allowed" : "pointer" }}
                  >
                    {isProcessing ? "記録中..." : "風景をアトラスに記録する"}
                  </button>
                </div>
              </section>
            </div>
          )}
        </>
      )}

      {activeView === "weekly" && weeklySource && (
        <div className="weekly-quest">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <button className="rpg-button" onClick={() => setActiveView("home")} style={{ width: "auto", padding: "5px 15px" }}>
              ◀ 拠点に戻る
            </button>
            <h2 style={{ margin: 0 }}>週クエスト</h2>
          </div>

          <section className="rpg-box">
            <div className="rpg-title">今回の素材</div>
            <div style={{ 
              margin: "15px 0", 
              padding: "15px", 
              backgroundColor: "#f0f0f0", 
              borderRadius: "8px",
              borderLeft: "5px solid #e67e22"
            }}>
              <p style={{ fontSize: "0.8rem", color: "#888", marginBottom: "5px" }}>
                過去の{weeklySource.type === "idea" ? "アイデア" : "風景"}から選出されました
              </p>
              <p style={{ fontSize: "1.1rem", fontWeight: "bold" }}>{weeklySource.content}</p>
            </div>
          </section>

          <section className="rpg-box">
            <div className="rpg-title">強化ヒント</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", margin: "15px 0" }}>
              {weeklyHints.map((hint, i) => (
                <div key={i} style={{ 
                  padding: "10px", 
                  backgroundColor: "#fff3e0", 
                  border: "1px dashed #e67e22",
                  borderRadius: "8px",
                  fontSize: "0.9rem",
                  color: "#d35400"
                }}>
                  <strong>ヒント {i + 1}:</strong><br/>{hint.text}<br/>
                  <small style={{ color: "#7f8c8d" }}>({hint.categoryLabel})</small>
                </div>
              ))}
            </div>
          </section>

          <section className="rpg-box">
            <div className="rpg-title">新アイデアの錬成</div>
            <div style={{ marginTop: "15px" }}>
              <p style={{ fontSize: "0.9rem", marginBottom: "10px" }}>
                素材と2つのヒントを組み合わせて、さらに詳細なアイデアに発展させてください。
              </p>
              <textarea 
                className="rpg-input"
                rows={5}
                placeholder="ここで錬成されたアイデアは、あなたの物語の核となるでしょう..."
                value={weeklyInput}
                onChange={(e) => setWeeklyInput(e.target.value)}
                style={{ width: "100%", padding: "15px", marginBottom: "15px" }}
              />
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "0.9rem", fontWeight: "bold", marginBottom: "5px" }}>完成度の評価</label>
                <div className="star-rating">
                  {[1, 2, 3].map((star) => (
                    <span
                      key={star}
                      className={`star ${weeklyRating >= star ? "active" : ""}`}
                      onClick={() => setWeeklyRating(star)}
                    >
                      ★
                    </span>
                  ))}
                </div>
              </div>
              <button 
                className="rpg-button primary" 
                onClick={handleSaveWeekly}
                disabled={isProcessing}
                style={{ opacity: isProcessing ? 0.7 : 1, cursor: isProcessing ? "not-allowed" : "pointer" }}
              >
                {isProcessing ? "錬成中..." : "錬成完了（保存して拠点へ）"}
              </button>
            </div>
          </section>
        </div>
      )}

      {activeView === "boss" && (
        <div style={{ textAlign: "center", padding: "50px 0" }}>
          <h2>👹 月ボス</h2>
          <p>強大なインスピレーションとの戦いが待っている...</p>
          <div className="rpg-box" style={{ margin: "30px auto", maxWidth: "300px" }}>
            Coming Soon
          </div>
          <button className="rpg-button" onClick={() => setActiveView("home")}>
            ◀ 拠点に戻る
          </button>
        </div>
      )}

      {activeView === "atlas" && (
        <div className="atlas-section">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <button className="rpg-button" onClick={() => setActiveView("home")} style={{ width: "auto", padding: "5px 15px" }}>
              ◀ 拠点に戻る
            </button>
            <h2 style={{ margin: 0 }}>図鑑・マップ</h2>
          </div>

          <section className="rpg-box" style={{ marginBottom: "20px" }}>
            <div className="rpg-title">タグフィルター</div>
            <div style={{ marginTop: "10px" }}>
              <input 
                type="text" 
                className="rpg-input" 
                placeholder="タグで絞り込み..." 
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
              />
              <p style={{ fontSize: "0.75rem", color: "#888", marginTop: "5px" }}>
                ※入力した文字が含まれるタグを持つアイテムのみ表示します。
              </p>
            </div>
          </section>

          <div style={{ display: "grid", gap: "20px" }}>
            {/* 週クエストの記録 */}
            <section className="rpg-box">
              <div className="rpg-title">週クエストの成果（錬成手帳）</div>
              <div style={{ marginTop: "15px" }}>
                {weeklyIdeaList.length === 0 ? (
                  <p style={{ color: "#666" }}>まだ記録がありません。</p>
                ) : (
                  weeklyIdeaList.map((idea) => (
                    <div key={idea.id} style={{ borderBottom: "1px solid #ddd", padding: "10px 0", marginBottom: "10px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "#888" }}>
                        <span>{idea.date}</span>
                        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                          <span style={{ color: "#ffcc00" }}>{"★".repeat(idea.rating)}</span>
                          <button 
                            onClick={() => editingId === idea.id ? handleSaveEditWeekly() : startEditWeekly(idea)}
                            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1rem", padding: "0 5px" }}
                            title={editingId === idea.id ? "保存" : "編集"}
                          >
                            {editingId === idea.id ? "💾" : "📝"}
                          </button>
                          <button 
                            onClick={() => handleDeleteWeekly(idea.id)}
                            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1rem", padding: "0 5px" }}
                            title="削除"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "#e67e22", margin: "5px 0" }}>
                        元ネタ: {idea.sourceContent}
                      </div>
                      {editingId === idea.id ? (
                        <div style={{ marginTop: "10px" }}>
                          <textarea 
                            className="rpg-input"
                            value={editForm?.content}
                            onChange={(e) => setEditForm({...editForm!, content: e.target.value})}
                            style={{ width: "100%", padding: "10px", marginBottom: "5px" }}
                          />
                          <div className="star-rating" style={{ marginBottom: "10px" }}>
                            {[1, 2, 3].map((star) => (
                              <span
                                key={star}
                                className={`star ${editForm!.rating >= star ? "active" : ""}`}
                                onClick={() => setEditForm({...editForm!, rating: star})}
                              >
                                ★
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div style={{ padding: "10px", backgroundColor: "#f9f9f9", borderRadius: "4px", borderLeft: "4px solid #e67e22" }}>
                          {idea.content}
                        </div>
                      )}
                      <div style={{ fontSize: "0.7rem", color: "#888", marginTop: "5px" }}>
                        使用ヒント: {idea.hints.join(" / ")}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* ダンジョンの記録 */}
            <section className="rpg-box">
              <div className="rpg-title">採掘済みのアイデア</div>
              <div style={{ marginTop: "15px" }}>
                {/**
                 * 【注釈】配列のフィルタリング (filter):
                 * 1. tagFilter が空（何も入力されていない）なら、すべてのアイテムを表示します。
                 * 2. tagFilter に文字が入っている場合、some() を使って「タグ配列の中に、フィルター文字を含むタグがあるか」をチェックします。
                 * 3. 条件に合う（trueを返す）アイテムだけが新しい配列に残り、画面に表示されます。
                 */}
                {ideaList.length === 0 ? (
                  <p style={{ color: "#666" }}>まだ記録がありません。</p>
                ) : (
                  ideaList
                    .filter(idea => 
                      !tagFilter || (idea.tags || []).some(tag => tag.toLowerCase().includes(tagFilter.toLowerCase()))
                    )
                    .map((idea) => (
                    <div key={idea.id} style={{ borderBottom: "1px solid #ddd", padding: "10px 0", marginBottom: "10px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "#888" }}>
                        <span>{idea.date}</span>
                        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                          <span style={{ color: "#ffcc00" }}>{"★".repeat(idea.rating)}</span>
                          <button 
                            onClick={() => editingId === idea.id ? handleSaveEditIdea() : startEditIdea(idea)}
                            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1rem", padding: "0 5px" }}
                            title={editingId === idea.id ? "保存" : "編集"}
                          >
                            {editingId === idea.id ? "💾" : "📝"}
                          </button>
                          <button 
                            onClick={() => handleDeleteIdea(idea.id)}
                            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1rem", padding: "0 5px" }}
                            title="削除"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                      <div style={{ fontSize: "0.9rem", color: "#555", margin: "5px 0" }}>
                        お題: {idea.theme.subject}
                      </div>
                      {/* タグの表示 */}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginBottom: "8px" }}>
                        {(idea.tags || []).map((tag, idx) => (
                          <span key={idx} style={{
                            fontSize: "0.7rem",
                            border: "1px solid #3498db",
                            color: "#3498db",
                            padding: "1px 6px",
                            borderRadius: "10px",
                            backgroundColor: "white"
                          }}>
                            #{tag}
                          </span>
                        ))}
                      </div>
                      {editingId === idea.id ? (
                        <div style={{ marginTop: "10px" }}>
                          <textarea 
                            className="rpg-input"
                            value={editForm?.content}
                            onChange={(e) => setEditForm({...editForm!, content: e.target.value})}
                            style={{ width: "100%", padding: "10px", marginBottom: "5px" }}
                          />
                          <input 
                            type="text"
                            className="rpg-input"
                            placeholder="タグ (カンマ区切り)"
                            value={editForm?.tags}
                            onChange={(e) => setEditForm({...editForm!, tags: e.target.value})}
                            style={{ width: "100%", padding: "5px", marginBottom: "10px", fontSize: "0.85rem" }}
                          />
                          <div className="star-rating" style={{ marginBottom: "10px" }}>
                            {[1, 2, 3].map((star) => (
                              <span
                                key={star}
                                className={`star ${editForm!.rating >= star ? "active" : ""}`}
                                onClick={() => setEditForm({...editForm!, rating: star})}
                              >
                                ★
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div style={{ padding: "8px 12px", backgroundColor: "#f0f7ff", borderRadius: "4px", borderLeft: "4px solid #3498db" }}>
                          {idea.content}
                        </div>
                      )}
                      <div style={{ fontSize: "0.7rem", color: "#888", marginTop: "5px" }}>
                        使用ヒント: {idea.scamper} ({idea.scamperDescription})
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* 風景の記録 */}
            <section className="rpg-box">
              <div className="rpg-title">発見した風景</div>
              <div style={{ marginTop: "15px" }}>
                {mapList.length === 0 ? (
                  <p style={{ color: "#666" }}>まだ記録がありません。</p>
                ) : (
                  mapList
                    .filter(entry => 
                      !tagFilter || (entry.tags || []).some(tag => tag.toLowerCase().includes(tagFilter.toLowerCase()))
                    )
                    .map((entry) => (
                    <div key={entry.id} style={{ borderBottom: "1px solid #ddd", padding: "10px 0", marginBottom: "10px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "#888" }}>
                        <span>{entry.date}</span>
                        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                          <span style={{ color: "#ffcc00" }}>{"★".repeat(entry.rating)}</span>
                          <button 
                            onClick={() => editingId === entry.id ? handleSaveEditMap() : startEditMap(entry)}
                            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1rem", padding: "0 5px" }}
                            title={editingId === entry.id ? "保存" : "編集"}
                          >
                            {editingId === entry.id ? "💾" : "📝"}
                          </button>
                          <button 
                            onClick={() => handleDeleteMap(entry.id)}
                            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1rem", padding: "0 5px" }}
                            title="削除"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                      <div style={{ fontWeight: "bold", fontSize: "0.9rem", margin: "5px 0" }}>
                        {entry.landscape.location}
                      </div>
                      {/* タグの表示 */}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginBottom: "8px" }}>
                        {(entry.tags || []).map((tag, idx) => (
                          <span key={idx} style={{
                            fontSize: "0.7rem",
                            border: "1px solid #27ae60",
                            color: "#27ae60",
                            padding: "1px 6px",
                            borderRadius: "10px",
                            backgroundColor: "white"
                          }}>
                            #{tag}
                          </span>
                        ))}
                      </div>
                      {editingId === entry.id ? (
                        <div style={{ marginTop: "10px" }}>
                          <label style={{ display: "block", fontSize: "0.75rem", color: "#888" }}>見えるもの</label>
                          <textarea 
                            className="rpg-input"
                            value={editForm?.visuals}
                            onChange={(e) => setEditForm({...editForm!, visuals: e.target.value})}
                            style={{ width: "100%", padding: "5px", marginBottom: "5px", fontSize: "0.85rem" }}
                          />
                          <label style={{ display: "block", fontSize: "0.75rem", color: "#888" }}>起きていること</label>
                          <textarea 
                            className="rpg-input"
                            value={editForm?.events}
                            onChange={(e) => setEditForm({...editForm!, events: e.target.value})}
                            style={{ width: "100%", padding: "5px", marginBottom: "5px", fontSize: "0.85rem" }}
                          />
                          <label style={{ display: "block", fontSize: "0.75rem", color: "#888" }}>雰囲気</label>
                          <textarea 
                            className="rpg-input"
                            value={editForm?.atmosphere}
                            onChange={(e) => setEditForm({...editForm!, atmosphere: e.target.value})}
                            style={{ width: "100%", padding: "5px", marginBottom: "5px", fontSize: "0.85rem" }}
                          />
                          <label style={{ display: "block", fontSize: "0.75rem", color: "#888" }}>タグ (カンマ区切り)</label>
                          <input 
                            type="text"
                            className="rpg-input"
                            value={editForm?.tags}
                            onChange={(e) => setEditForm({...editForm!, tags: e.target.value})}
                            style={{ width: "100%", padding: "5px", marginBottom: "10px", fontSize: "0.85rem" }}
                          />
                          <div className="star-rating" style={{ marginBottom: "10px" }}>
                            {[1, 2, 3].map((star) => (
                              <span
                                key={star}
                                className={`star ${editForm!.rating >= star ? "active" : ""}`}
                                onClick={() => setEditForm({...editForm!, rating: star})}
                              >
                                ★
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <>
                          <div style={{ fontSize: "0.85rem", color: "#555", marginBottom: "5px" }}>
                            <strong>見えるもの:</strong> {entry.visuals}
                          </div>
                          <div style={{ fontSize: "0.85rem", color: "#555", marginBottom: "5px" }}>
                            <strong>起きていること:</strong> {entry.events}
                          </div>
                          <div style={{ fontSize: "0.85rem", color: "#555" }}>
                            <strong>雰囲気:</strong> {entry.atmosphere}
                          </div>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      )}

      <footer style={{ textAlign: "center", fontSize: "0.8rem", color: "#888", marginTop: "30px" }}>
        『グリッチ（Gri-Sketch）』 Prototype - アイデアの地平を広げよう
      </footer>

      {/* 演出用トーストメッセージ */}
      {showToast && (
        <div className="save-toast">
          {toastMessage}
        </div>
      )}
    </main>
  );
}
