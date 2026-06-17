"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";

export interface User {
  id: string;
  username: string;
  name: string;
  role: "admin" | "teacher";
  teacherRole?: "admin" | "teacher"; // teachers 表中的角色
  phone?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAdmin: boolean;
  isTeacher: boolean;
  authFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = "feedback_system_user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 从 localStorage 恢复用户基本信息（不含 Token）
  useEffect(() => {
    const storedUser = localStorage.getItem(STORAGE_KEY);
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        // 验证 token 是否仍然有效（通过调用一个需要认证的 API）
        fetch("/api/auth/me", { credentials: "include" })
          .then(res => {
            if (!res.ok) {
              // Token 无效或已过期，清除本地状态
              setUser(null);
              localStorage.removeItem(STORAGE_KEY);
            } else {
              return res.json();
            }
          })
          .then(data => {
            if (data?.user) {
              const updatedUser = { ...parsedUser, ...data.user };
              setUser(updatedUser);
              localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUser));
            }
          })
          .catch(() => {
            // 网络错误，不清除本地状态（可能是临时问题）
          });
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "登录失败");
    }

    const userData = data.user as User;
    setUser(userData);
    // 仅存储用户基本信息到 localStorage（Token 在 httpOnly Cookie 中，前端不操作）
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // 即使请求失败也清除本地状态
    }
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  // 带 Token 续签感知的 fetch wrapper
  const authFetch = useCallback(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const response = await fetch(input, {
      ...init,
      credentials: "include",
    });

    // 检查 X-New-Token 响应头，表示服务端已续签 Token
    const newToken = response.headers.get("X-New-Token");
    if (newToken) {
      // Token 已在 httpOnly Cookie 中由服务端中间件自动更新
      // 此处可做额外处理，如刷新用户信息等
      // 目前 Cookie 已自动更新，无需前端手动操作
    }

    return response;
  }, []);

  const isAuthenticated = user !== null;
  const isAdmin = user?.role === "admin";
  const isTeacher = user?.role === "teacher";

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated,
        login,
        logout,
        isAdmin,
        isTeacher,
        authFetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
