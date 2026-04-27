document.getElementById('runBtn').addEventListener('click', async () => {
  const visibility = document.getElementById('visibility').value;
  const madeForKids = document.getElementById('madeForKids').value;
  const btn = document.getElementById('runBtn');
  const status = document.getElementById('status');

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab.url || !tab.url.includes('studio.youtube.com')) {
    status.className = 'error';
    status.textContent = '❌ YouTube Studio のページで実行してください。';
    return;
  }

  btn.disabled = true;
  status.className = 'running';
  status.textContent = '⏳ 処理中... しばらくお待ちください。';

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: runPublisher,
      args: [visibility, madeForKids]
    });

    status.className = 'done';
    status.textContent = '✅ 処理完了！ページを確認してください。';
  } catch (e) {
    status.className = 'error';
    status.textContent = '❌ エラーが発生しました: ' + e.message;
  } finally {
    btn.disabled = false;
  }
});

async function runPublisher(visibility, madeForKids) {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  const DRAFT_BTN_SELECTOR =
    'ytcp-video-list-cell-actions ytcp-button.edit-draft-button';

  const KIDS_SELECTORS = {
    not: ['[name="VIDEO_MADE_FOR_KIDS_NOT_MFK"]'],
    yes: ['[name="VIDEO_MADE_FOR_KIDS_MFK"]'],
  };

  const VISIBILITY_LABEL = {
    public:   '公開',
    unlisted: '限定公開',
    private:  '非公開',
  };

  // ラベルテキストでラジオボタンを探してクリック
  const clickRadioByLabel = async (labelText, timeout = 8000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const buttons = document.querySelectorAll('tp-yt-paper-radio-button');
      for (const btn of buttons) {
        const label = btn.querySelector('#radioLabel');
        if (!label) continue;
        const ve = label.querySelector('ytcp-ve');
        const text = (ve ? ve.textContent : label.textContent).trim();
        if (text === labelText) {
          btn.click();
          console.log('公開設定クリック成功:', labelText);
          return true;
        }
      }
      await sleep(300);
    }
    console.warn('公開設定ラジオボタンが見つかりません:', labelText);
    return false;
  };

  // セレクター候補リストから最初に見つかった要素をクリック
  const clickFirstMatch = async (selectors, timeout = 6000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) {
          el.click();
          console.log('クリック成功:', sel);
          return true;
        }
      }
      await sleep(300);
    }
    console.warn('要素が見つかりません:', selectors);
    return false;
  };

  // 共有ダイアログの「閉じる」ボタンを閉じる
  const closeShareDialog = async (timeout = 8000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      // 共有ダイアログが表示されているか確認
      const dialog = document.querySelector('ytcp-video-share-dialog tp-yt-paper-dialog, ytcp-video-share-dialog ytcp-dialog');
      if (!dialog) return true; // ダイアログなし、スキップ

      // 閉じるボタン候補
      const closeSelectors = [
        'ytcp-video-share-dialog ytcp-button#close-button',
        'ytcp-video-share-dialog #close-button',
        'ytcp-dialog #close-button',
      ];
      for (const sel of closeSelectors) {
        const el = document.querySelector(sel);
        if (el) {
          el.click();
          console.log('共有ダイアログを閉じました:', sel);
          await sleep(1000);
          return true;
        }
      }
      await sleep(300);
    }
    console.warn('共有ダイアログの閉じるボタンが見つかりません');
    return false;
  };

  const LAST_STEP_SELECTORS = [
    '#step-title-3',
    'ytcp-stepper #step-badge-3',
    'ytcp-ve[id="step-title-3"]',
  ];

  const DONE_SELECTORS = [
    '#done-button',
    'ytcp-button#done-button',
    '[id="done-button"]',
  ];

  let count = 0;

  while (true) {
    // ドラフトボタンを全取得して末尾のものをクリック
    const draftBtns = document.querySelectorAll(DRAFT_BTN_SELECTOR);
    if (!draftBtns.length) break;
    const draftBtn = draftBtns[draftBtns.length - 1];

    draftBtn.click();
    await sleep(3500);

    // 子ども向け設定
    await clickFirstMatch(KIDS_SELECTORS[madeForKids]);
    await sleep(2000);

    // 公開設定ステップへ移動
    await clickFirstMatch(LAST_STEP_SELECTORS);
    await sleep(2500);

    // 公開設定をラベルテキストで選択
    await clickRadioByLabel(VISIBILITY_LABEL[visibility]);
    await sleep(2000);

    // 保存
    await clickFirstMatch(DONE_SELECTORS);
    await sleep(5000);

    // 保存後に出る共有ダイアログを閉じる
    await closeShareDialog();
    await sleep(3000);

    count++;
    console.log(`✅ ${count}件処理完了`);
  }

  console.log(`🎉 全${count}件の処理が完了しました`);
  alert(`✅ ${count}件のドラフト動画を処理しました！`);
}
