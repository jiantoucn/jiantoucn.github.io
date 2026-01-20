import React, { useState, useEffect, useCallback } from 'react';
import { Search, ExternalLink, Users, Gamepad2, Settings, AlertCircle, RefreshCw, Trash2 } from 'lucide-react';
import { TwitchApiService, TwitchStreamInfo } from '../services/twitchApi';

interface TwitchDashboardProps {}

export const TwitchDashboard: React.FC<TwitchDashboardProps> = () => {
  // 状态管理
  const [urls, setUrls] = useState<string>('');
  const [streams, setStreams] = useState<TwitchStreamInfo[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string>(() => localStorage.getItem('twitch_client_id') || '');
  const [clientSecret, setClientSecret] = useState<string>(() => localStorage.getItem('twitch_client_secret') || '');
  const [showSettings, setShowSettings] = useState<boolean>(!clientId || !clientSecret);

  // 保存凭据到本地存储
  useEffect(() => {
    localStorage.setItem('twitch_client_id', clientId);
    localStorage.setItem('twitch_client_secret', clientSecret);
  }, [clientId, clientSecret]);

  // 获取数据的核心逻辑
  const fetchData = useCallback(async () => {
    if (!clientId || !clientSecret) {
      setError('请先在设置中配置 Twitch Client ID 和 Client Secret');
      setShowSettings(true);
      return;
    }

    if (!urls.trim()) {
      setError('请输入 Twitch 直播间链接');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. 获取登录名列表
      const logins = urls
        .split('\n')
        .map(url => TwitchApiService.extractLoginFromUrl(url.trim()))
        .filter((login): login is string => login !== null);

      if (logins.length === 0) {
        throw new Error('未识别到有效的 Twitch 链接');
      }

      // 2. 获取访问令牌
      const accessToken = await TwitchApiService.getAccessToken(clientId, clientSecret);

      // 3. 获取直播信息
      const streamData = await TwitchApiService.getStreams(logins, clientId, accessToken);
      
      // 按在线人数降序排序
      setStreams(streamData.sort((a, b) => b.viewer_count - a.viewer_count));
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取数据时发生错误');
    } finally {
      setLoading(false);
    }
  }, [urls, clientId, clientSecret]);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* 头部 */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">
              Twitch 实时状态查询
            </h1>
            <p className="text-gray-400 mt-2">输入直播间链接，即刻获取在线人数和直播详情</p>
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors border border-gray-700"
          >
            <Settings className="w-5 h-5" />
            <span>{showSettings ? '隐藏设置' : 'API 设置'}</span>
          </button>
        </header>

        {/* 设置区域 */}
        {showSettings && (
          <section className="bg-gray-800 p-6 rounded-xl border border-gray-700 animate-in fade-in slide-in-from-top-4 duration-300">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5 text-purple-400" />
              API 凭据配置
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-gray-400">Client ID</label>
                <input
                  type="password"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="从 Twitch Dev Portal 获取"
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-gray-400">Client Secret</label>
                <input
                  type="password"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder="请妥善保管您的 Secret"
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-4 italic">
              * 您的凭据仅存储在本地浏览器的 localStorage 中，不会上传到任何服务器。
            </p>
          </section>
        )}

        {/* 输入区域 */}
        <section className="bg-gray-800 p-6 rounded-xl border border-gray-700 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Search className="w-5 h-5 text-blue-400" />
              直播间链接
            </h2>
            <button
              onClick={() => setUrls('')}
              className="text-gray-400 hover:text-red-400 transition-colors"
              title="清空"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
          <textarea
            value={urls}
            onChange={(e) => setUrls(e.target.value)}
            aria-label="Twitch 直播间链接输入框"
            placeholder="每行输入一个链接，例如:&#10;https://www.twitch.tv/shroud&#10;https://www.twitch.tv/ninja"
            className="w-full h-32 bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none font-mono text-sm"
          />
          <button
            onClick={fetchData}
            disabled={loading}
            aria-busy={loading}
            className="w-full md:w-auto px-8 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed rounded-lg font-bold flex items-center justify-center gap-2 transition-all"
          >
            {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
            {loading ? '正在查询...' : '立即查询'}
          </button>
        </section>

        {/* 错误提示 */}
        {error && (
          <div className="bg-red-900/30 border border-red-500/50 text-red-200 p-4 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {/* 结果展示 */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {streams.map((stream) => (
            <div
              key={stream.id}
              className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700 hover:border-purple-500/50 transition-all group"
            >
              {/* 缩略图 */}
              <div className="relative aspect-video">
                <img
                  src={stream.thumbnail_url.replace('{width}', '440').replace('{height}', '248')}
                  alt={stream.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute top-2 left-2 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded flex items-center gap-1">
                  <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  LIVE
                </div>
                <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {stream.viewer_count.toLocaleString()}
                </div>
              </div>

              {/* 信息 */}
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-lg line-clamp-1 group-hover:text-purple-400 transition-colors">
                    {stream.user_name}
                  </h3>
                  <a
                    href={`https://twitch.tv/${stream.user_login}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
                
                <p className="text-sm text-gray-300 line-clamp-2 h-10 leading-snug">
                  {stream.title}
                </p>

                <div className="pt-2 border-t border-gray-700 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-gray-400">
                    <Gamepad2 className="w-4 h-4 text-pink-500" />
                    <span className="truncate max-w-[150px]">{stream.game_name || '未知板块'}</span>
                  </div>
                  <span className="text-gray-500 text-xs">
                    {new Date(stream.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} 开播
                  </span>
                </div>
              </div>
            </div>
          ))}

          {!loading && streams.length === 0 && !error && urls && (
            <div className="col-span-full py-20 text-center text-gray-500 border-2 border-dashed border-gray-800 rounded-xl">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>未发现正在直播的频道</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
