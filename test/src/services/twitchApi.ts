export interface TwitchStreamInfo {
  id: string;
  user_id: string;
  user_login: string;
  user_name: string;
  game_id: string;
  game_name: string;
  type: string;
  title: string;
  viewer_count: number;
  started_at: string;
  language: string;
  thumbnail_url: string;
}

export interface TwitchAuth {
  clientId: string;
  clientSecret: string;
  accessToken?: string;
}

export class TwitchApiService {
  private static AUTH_URL = 'https://id.twitch.tv/oauth2/token';
  private static API_BASE_URL = 'https://api.twitch.tv/helix';

  /**
   * 获取 App Access Token (Client Credentials Flow)
   * 注意：在纯前端环境中使用 Client Secret 存在安全风险，
   * 建议在生产环境中使用后端代理或让用户提供自己的凭据。
   */
  static async getAccessToken(clientId: string, clientSecret: string): Promise<string> {
    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    });

    const response = await fetch(`${this.AUTH_URL}?${params.toString()}`, {
      method: 'POST',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || '获取访问令牌失败');
    }

    const data = await response.json();
    return data.access_token;
  }

  /**
   * 根据频道登录名获取直播信息
   */
  static async getStreams(logins: string[], clientId: string, accessToken: string): Promise<TwitchStreamInfo[]> {
    if (logins.length === 0) return [];

    const params = new URLSearchParams();
    logins.forEach(login => params.append('user_login', login));

    const response = await fetch(`${this.API_BASE_URL}/streams?${params.toString()}`, {
      headers: {
        'Client-ID': clientId,
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || '获取直播信息失败');
    }

    const data = await response.json();
    return data.data;
  }

  /**
   * 从 URL 中提取频道登录名
   */
  static extractLoginFromUrl(url: string): string | null {
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.hostname === 'twitch.tv' || parsedUrl.hostname === 'www.twitch.tv') {
        const pathParts = parsedUrl.pathname.split('/').filter(part => part.length > 0);
        return pathParts[0] || null;
      }
      return null;
    } catch {
      // 可能是直接输入的用户名
      return url.trim() || null;
    }
  }
}
