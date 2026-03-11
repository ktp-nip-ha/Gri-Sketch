/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export', // 【注釈】これを入れると、Webサイト用の「静的なファイル」として書き出されます
  images: {
    unoptimized: true, // 【注釈】GitHub Pagesで画像を表示させるための設定です
  },
};

export default nextConfig;