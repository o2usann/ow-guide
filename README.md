# おつゆのOWガイド

## GitHub Pages で公開する

1. GitHub に公開リポジトリを作り、このフォルダーの中身をリポジトリ直下に入れます。
2. リポジトリの **Settings → Pages** を開きます。
3. **Source** を **Deploy from a branch** にし、**main / (root)** を選んで **Save** を押します。
4. 公開が終わると **Settings → Pages** に閲覧用 URL が表示されます。

公開すると、ガイド・JSON・画像は誰でも閲覧できます。リポジトリを書き換えられるのは GitHub で書き込み権限を持つ人です。

## データの更新先

`data/guide.json` がガイドで使うデータです。最上位の `heroes` と `maps` に、表示用のヒーローとマップを格納します。
画像を同梱する場合は `assets/heroes/` または `assets/maps/` に置き、JSON の画像パスもその場所に合わせます。
ガイドはページを開くたびに GitHub Pages 上の JSON を読み込みます。変更を main に反映し、Pages の公開が完了してからブラウザーを更新してください。
