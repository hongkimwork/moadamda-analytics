/**
 * Authentication Context
 * 로그인 상태 관리 및 인증 관련 함수 제공
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

// API 기본 URL
const API_BASE = import.meta.env.DEV ? 'http://localhost:3003' : '';

// Context 생성
const AuthContext = createContext(null);

// 세션 스토리지 키
const TOKEN_KEY = 'moadamda_auth_token';
const USER_KEY = 'moadamda_auth_user';

/**
 * AuthProvider 컴포넌트
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // 초기화: 세션 스토리지에서 토큰 복원
  useEffect(() => {
    const initAuth = async () => {
      try {
        const savedToken = sessionStorage.getItem(TOKEN_KEY);
        const savedUser = sessionStorage.getItem(USER_KEY);

        if (savedToken && savedUser) {
          // 토큰 유효성 검증
          const response = await axios.get(`${API_BASE}/api/auth/me`, {
            headers: { Authorization: `Bearer ${savedToken}` }
          });

          if (response.data.user) {
            setToken(savedToken);
            setUser(response.data.user);
          } else {
            // 토큰이 유효하지 않으면 제거
            sessionStorage.removeItem(TOKEN_KEY);
            sessionStorage.removeItem(USER_KEY);
          }
        }
      } catch (error) {
        // 토큰이 만료되었거나 유효하지 않음
        console.log('Auth init failed:', error.response?.data?.error || error.message);
        sessionStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(USER_KEY);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  // 로그인
  const login = useCallback(async (email, password) => {
    const response = await axios.post(`${API_BASE}/api/auth/login`, {
      email,
      password
    });

    const { token: newToken, user: newUser } = response.data;

    // 세션 스토리지에 저장
    sessionStorage.setItem(TOKEN_KEY, newToken);
    sessionStorage.setItem(USER_KEY, JSON.stringify(newUser));

    setToken(newToken);
    setUser(newUser);

    return newUser;
  }, []);

  // 로그아웃
  const logout = useCallback(async () => {
    try {
      if (token) {
        await axios.post(`${API_BASE}/api/auth/logout`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
    } catch (error) {
      // 로그아웃 API 실패해도 클라이언트에서는 로그아웃 처리
      console.log('Logout API error:', error.message);
    }

    // 세션 스토리지에서 제거
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);

    setToken(null);
    setUser(null);
  }, [token]);

  // 비밀번호 변경
  const changePassword = useCallback(async (currentPassword, newPassword) => {
    await axios.put(`${API_BASE}/api/auth/password`, {
      currentPassword,
      newPassword
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }, [token]);

  // 인증된 API 요청을 위한 헤더 생성
  const getAuthHeaders = useCallback(() => {
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [token]);

  // 권한 확인 헬퍼
  const hasRole = useCallback((roles) => {
    if (!user) return false;
    if (typeof roles === 'string') return user.role === roles;
    return roles.includes(user.role);
  }, [user]);

  const isMaster = useCallback(() => hasRole('master'), [hasRole]);
  const isAdmin = useCallback(() => hasRole(['master', 'admin']), [hasRole]);

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!user,
    login,
    logout,
    changePassword,
    getAuthHeaders,
    hasRole,
    isMaster,
    isAdmin
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * useAuth 훅
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
