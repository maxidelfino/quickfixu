# Technical Design Document: Fase 6 - Admin Panel & OCR Certification Validation

**Change:** `fase-6-admin-ocr`  
**Version:** 1.0  
**Date:** March 2026  
**Status:** Design Complete  
**Prerequisites:** Fase 4 (Payments & Appointments) COMPLETE, Fase 5 (Reviews) optional

---

## 1. Architecture Overview

### 1.1 High-Level System Architecture

```mermaid
graph TB
    subgraph "Admin Panel (React.js)"
        AdminUI[Admin UI Components]
        ReactQuery[React Query Cache]
        AdminAuth[Admin Auth Context]
        MUI[Material-UI Components]
    end

    subgraph "Backend API (Express + TypeScript)"
        AdminAPI[Admin Endpoints]
        AuthMiddleware[requireAdmin Middleware]
        BusinessLogic[Business Logic Layer]
        OCRService[OCR Service]
    end

    subgraph "Background Jobs"
        BullQueue[Bull Queue]
        OCRWorker[Tesseract OCR Worker]
        Sharp[Sharp Preprocessing]
        Poppler[PDF-Poppler]
    end

    subgraph "Data Layer"
        Postgres[(PostgreSQL 15)]
        Redis[(Redis Cache)]
        Cloudinary[Cloudinary CDN]
    end

    subgraph "External Services"
        MP[MercadoPago API]
        FCM[Firebase Cloud Messaging]
    end

    AdminUI --> ReactQuery
    AdminUI --> AdminAuth
    AdminUI --> MUI
    ReactQuery --> AdminAPI
    AdminAuth --> AdminAPI
    AdminAPI --> AuthMiddleware
    AuthMiddleware --> BusinessLogic
    BusinessLogic --> Postgres
    BusinessLogic --> Redis
    BusinessLogic --> BullQueue
    BusinessLogic --> MP
    BusinessLogic --> FCM
    BullQueue --> OCRWorker
    OCRWorker --> Sharp
    OCRWorker --> Poppler
    OCRWorker --> Cloudinary
    OCRWorker --> Postgres
    OCRService --> OCRWorker
```

### 1.2 OCR Pipeline Flow

```mermaid
sequenceDiagram
    participant Pro as Professional
    participant API as Express API
    participant Queue as Bull Queue
    participant Worker as OCR Worker
    participant Poppler as pdf-poppler
    participant Sharp as sharp
    participant Tess as Tesseract.js
    participant DB as PostgreSQL
    participant FCM as Firebase

    Pro->>API: Upload certification (PDF/PNG)
    API->>Cloudinary: Upload file
    Cloudinary-->>API: file_url
    API->>DB: Create certification record (status=pending)
    API->>Queue: Enqueue job {certificationId}
    API-->>Pro: 202 Accepted

    Queue->>Worker: Process job
    Worker->>Cloudinary: Download file
    
    alt PDF file
        Worker->>Poppler: Convert PDF → PNG array
        Poppler-->>Worker: PNG buffers
    end
    
    loop For each page
        Worker->>Sharp: Preprocess (grayscale, resize, normalize, sharpen)
        Sharp-->>Worker: Optimized buffer
        Worker->>Tess: OCR recognize('spa')
        Tess-->>Worker: { text, confidence }
    end

    Worker->>Worker: Combine text from all pages
    Worker->>Worker: Parse with regex patterns
    Worker->>DB: Update certification.ocr_data
    
    alt confidence < 60%
        Worker->>DB: Set low_confidence flag
    end
    
    Worker->>FCM: Notify professional "Certificación procesada"
```

### 1.3 Admin Login Sequence

```mermaid
sequenceDiagram
    participant UI as Admin Panel
    participant API as Express API
    participant RL as Rate Limiter
    participant DB as PostgreSQL
    participant Redis as Redis

    UI->>API: POST /api/admin/login
    API->>RL: Check IP attempts
    RL->>Redis: GET login_attempts:{ip}
    Redis-->>RL: 3 attempts
    RL-->>API: Allow (< 5)

    API->>DB: SELECT admin WHERE email
    DB-->>API: Admin record
    API->>API: bcrypt.compare(password, hash)
    
    alt Password valid
        API->>API: jwt.sign({ id, role: 'admin', is_super })
        API->>Redis: DEL login_attempts:{ip}
        API-->>UI: { token, admin }
        UI->>UI: Store token in localStorage
        UI->>UI: Redirect to /admin/dashboard
    else Password invalid
        API->>Redis: INCR login_attempts:{ip}
        API->>DB: INSERT admin_login_attempts (failed)
        API-->>UI: 401 Unauthorized
    end
```

### 1.4 Dispute Resolution Flow

```mermaid
stateDiagram-v2
    [*] --> Open: User creates dispute
    Open --> Investigating: Admin reviews
    
    Investigating --> RefundTotal: Admin clicks Refund Total
    Investigating --> RefundPartial: Admin clicks Refund Partial
    Investigating --> PayoutPro: Admin clicks Payout Professional
    Investigating --> Closed: Admin clicks Close No Action

    RefundTotal --> MPRefund: Call MercadoPago API
    RefundPartial --> MPRefund
    PayoutPro --> MPPayout: Manual payout process
    
    MPRefund --> UpdateDB: Update payment.status
    MPPayout --> UpdateDB
    Closed --> UpdateDB
    
    UpdateDB --> NotifyUsers: Send FCM notifications
    NotifyUsers --> [*]
```

---

## 2. Technology Stack

### 2.1 Admin Panel (Frontend)

**Core Framework:**
```json
{
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "react-router-dom": "^6.20.0",
  "typescript": "^5.3.0"
}
```

**UI Framework:**
```json
{
  "@mui/material": "^5.15.0",
  "@mui/x-data-grid": "^6.18.0",
  "@mui/x-date-pickers": "^6.18.0",
  "@emotion/react": "^11.11.0",
  "@emotion/styled": "^11.11.0",
  "@mui/icons-material": "^5.15.0"
}
```

**State Management & API:**
```json
{
  "@tanstack/react-query": "^5.17.0",
  "axios": "^1.6.0"
}
```

**Forms & Validation:**
```json
{
  "react-hook-form": "^7.49.0",
  "zod": "^3.22.0",
  "@hookform/resolvers": "^3.3.0"
}
```

**Charts & Visualization:**
```json
{
  "recharts": "^2.10.0",
  "date-fns": "^3.0.0"
}
```

**Build Tools:**
```json
{
  "vite": "^5.0.0",
  "@vitejs/plugin-react": "^4.2.0",
  "vite-plugin-compression": "^0.5.1"
}
```

### 2.2 Backend (Node.js + TypeScript)

**OCR Stack:**
```json
{
  "tesseract.js": "^5.0.4",
  "sharp": "^0.33.2",
  "pdf-poppler": "^0.2.1"
}
```

**Queue System:**
```json
{
  "bull": "^4.12.2",
  "redis": "^4.6.12"
}
```

**Security:**
```json
{
  "bcrypt": "^5.1.1",
  "jsonwebtoken": "^9.0.2",
  "express-rate-limit": "^7.1.5",
  "helmet": "^7.1.0",
  "cors": "^2.8.5"
}
```

**Existing (Already in Backend):**
- Express.js 4.18+
- Prisma ORM 5.x
- MercadoPago SDK
- Firebase Admin SDK (FCM)

---

## 3. Admin Panel Architecture (React.js)

### 3.1 Folder Structure

```
admin-panel/
├── public/
│   ├── index.html
│   └── favicon.ico
├── src/
│   ├── api/
│   │   ├── client.ts              # Axios instance with JWT interceptor
│   │   ├── analytics.ts           # Dashboard API calls
│   │   ├── certifications.ts      # Certification endpoints
│   │   ├── disputes.ts            # Dispute resolution
│   │   ├── users.ts               # User management
│   │   ├── payments.ts            # Payment management
│   │   ├── reports.ts             # Content moderation
│   │   └── logs.ts                # Admin actions logs
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx        # Navigation sidebar
│   │   │   ├── TopBar.tsx         # Header with admin info
│   │   │   └── Layout.tsx         # Main layout wrapper
│   │   ├── common/
│   │   │   ├── DataTable.tsx      # Reusable table with pagination
│   │   │   ├── StatCard.tsx       # KPI card component
│   │   │   ├── ChartContainer.tsx # Chart wrapper
│   │   │   ├── ConfirmDialog.tsx  # Confirmation modal
│   │   │   ├── ImageViewer.tsx    # Image zoom/rotate viewer
│   │   │   └── FileUploader.tsx   # File upload component
│   │   └── specific/
│   │       ├── CertificationCard.tsx
│   │       ├── DisputeDetailView.tsx
│   │       ├── PaymentBreakdown.tsx
│   │       └── ChatHistoryViewer.tsx
│   ├── contexts/
│   │   ├── AuthContext.tsx        # Admin auth state
│   │   └── ThemeContext.tsx       # Theme customization
│   ├── hooks/
│   │   ├── useAuth.ts             # Auth hook
│   │   ├── useAdminDashboard.ts   # Dashboard data
│   │   ├── useCertifications.ts   # Certification queries
│   │   ├── useDisputes.ts         # Dispute queries
│   │   └── useDebounce.ts         # Search debouncing
│   ├── pages/
│   │   ├── Login.tsx              # Admin login page
│   │   ├── Dashboard.tsx          # Analytics dashboard
│   │   ├── Certifications/
│   │   │   ├── CertificationList.tsx
│   │   │   └── CertificationDetail.tsx
│   │   ├── Disputes/
│   │   │   ├── DisputeList.tsx
│   │   │   └── DisputeDetail.tsx
│   │   ├── Users/
│   │   │   ├── UserList.tsx
│   │   │   └── UserDetail.tsx
│   │   ├── Payments/
│   │   │   ├── PaymentList.tsx
│   │   │   └── PaymentDetail.tsx
│   │   ├── Reports/
│   │   │   ├── ReportList.tsx
│   │   │   └── ReportDetail.tsx
│   │   └── Logs/
│   │       ├── AdminActionLogs.tsx
│   │       └── WebhookLogs.tsx
│   ├── theme/
│   │   ├── theme.ts               # MUI theme config
│   │   └── colors.ts              # Color palette
│   ├── types/
│   │   ├── admin.ts               # Admin types
│   │   ├── certification.ts       # Certification types
│   │   ├── dispute.ts             # Dispute types
│   │   └── api.ts                 # API response types
│   ├── utils/
│   │   ├── formatters.ts          # Date, currency formatters
│   │   ├── validators.ts          # Form validators
│   │   └── constants.ts           # App constants
│   ├── App.tsx                    # Main app component
│   ├── main.tsx                   # Entry point
│   └── vite-env.d.ts
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

### 3.2 Material-UI Theme Configuration

**`src/theme/theme.ts`:**
```typescript
import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
      light: '#42a5f5',
      dark: '#1565c0',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#9c27b0',
      light: '#ba68c8',
      dark: '#7b1fa2',
      contrastText: '#ffffff',
    },
    success: {
      main: '#2e7d32',
      light: '#4caf50',
      dark: '#1b5e20',
    },
    warning: {
      main: '#ed6c02',
      light: '#ff9800',
      dark: '#e65100',
    },
    error: {
      main: '#d32f2f',
      light: '#ef5350',
      dark: '#c62828',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 600,
      fontSize: '2rem',
    },
    h5: {
      fontWeight: 500,
      fontSize: '1.5rem',
    },
    h6: {
      fontWeight: 500,
      fontSize: '1.25rem',
    },
    body1: {
      fontSize: '1rem',
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 8,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        },
      },
    },
  },
});
```

### 3.3 React Query Setup

**`src/api/client.ts`:**
```typescript
import axios, { AxiosError } from 'axios';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: Add JWT token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('admin_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: Handle 401 Unauthorized
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('admin_token');
      window.location.href = '/admin/login';
    }
    return Promise.reject(error);
  }
);
```

**`src/main.tsx`:**
```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { theme } from './theme/theme';
import App from './App';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
    mutations: {
      retry: 0,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <App />
        </ThemeProvider>
      </BrowserRouter>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </React.StrictMode>
);
```

### 3.4 Routing Structure

**`src/App.tsx`:**
```typescript
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Login from './pages/Login';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import CertificationList from './pages/Certifications/CertificationList';
import CertificationDetail from './pages/Certifications/CertificationDetail';
import DisputeList from './pages/Disputes/DisputeList';
import DisputeDetail from './pages/Disputes/DisputeDetail';
import UserList from './pages/Users/UserList';
import UserDetail from './pages/Users/UserDetail';
import PaymentList from './pages/Payments/PaymentList';
import ReportList from './pages/Reports/ReportList';
import AdminActionLogs from './pages/Logs/AdminActionLogs';
import WebhookLogs from './pages/Logs/WebhookLogs';
import PrivateRoute from './components/PrivateRoute';

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/admin/login" element={<Login />} />
        <Route
          path="/admin"
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="certifications" element={<CertificationList />} />
          <Route path="certifications/:id" element={<CertificationDetail />} />
          <Route path="disputes" element={<DisputeList />} />
          <Route path="disputes/:id" element={<DisputeDetail />} />
          <Route path="users" element={<UserList />} />
          <Route path="users/:id" element={<UserDetail />} />
          <Route path="payments" element={<PaymentList />} />
          <Route path="reports" element={<ReportList />} />
          <Route path="logs/actions" element={<AdminActionLogs />} />
          <Route path="logs/webhooks" element={<WebhookLogs />} />
        </Route>
        <Route path="*" element={<Navigate to="/admin/login" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
```

### 3.5 Protected Routes Implementation

**`src/contexts/AuthContext.tsx`:**
```typescript
import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiClient } from '../api/client';

interface Admin {
  id: number;
  email: string;
  full_name: string;
  is_super_admin: boolean;
}

interface AuthContextType {
  admin: Admin | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing token on mount
    const token = localStorage.getItem('admin_token');
    if (token) {
      // Validate token by fetching admin profile
      apiClient
        .get('/admin/me')
        .then((response) => setAdmin(response.data.admin))
        .catch(() => {
          localStorage.removeItem('admin_token');
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const response = await apiClient.post('/admin/login', { email, password });
    const { token, admin } = response.data;
    localStorage.setItem('admin_token', token);
    setAdmin(admin);
  };

  const logout = () => {
    localStorage.removeItem('admin_token');
    setAdmin(null);
  };

  return (
    <AuthContext.Provider
      value={{
        admin,
        isAuthenticated: !!admin,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

**`src/components/PrivateRoute.tsx`:**
```typescript
import { Navigate } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';

export default function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/admin/login" replace />;
}
```

### 3.6 Shared Components

**`src/components/common/DataTable.tsx`:**
```typescript
import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Paper,
  CircularProgress,
  Box,
  TableSortLabel,
} from '@mui/material';

interface Column<T> {
  id: keyof T;
  label: string;
  minWidth?: number;
  align?: 'left' | 'right' | 'center';
  format?: (value: any, row: T) => string | React.ReactNode;
  sortable?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  loading?: boolean;
  page: number;
  rowsPerPage: number;
  totalRows: number;
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (rowsPerPage: number) => void;
  onRowClick?: (row: T) => void;
  orderBy?: keyof T;
  order?: 'asc' | 'desc';
  onSort?: (column: keyof T) => void;
}

export function DataTable<T extends { id: number | string }>({
  columns,
  rows,
  loading,
  page,
  rowsPerPage,
  totalRows,
  onPageChange,
  onRowsPerPageChange,
  onRowClick,
  orderBy,
  order = 'asc',
  onSort,
}: DataTableProps<T>) {
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Paper>
      <TableContainer sx={{ maxHeight: 600 }}>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell
                  key={String(column.id)}
                  align={column.align}
                  style={{ minWidth: column.minWidth }}
                  sx={{ fontWeight: 'bold', backgroundColor: 'primary.light', color: 'white' }}
                >
                  {column.sortable && onSort ? (
                    <TableSortLabel
                      active={orderBy === column.id}
                      direction={orderBy === column.id ? order : 'asc'}
                      onClick={() => onSort(column.id)}
                      sx={{ color: 'white !important' }}
                    >
                      {column.label}
                    </TableSortLabel>
                  ) : (
                    column.label
                  )}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.id}
                hover
                onClick={() => onRowClick?.(row)}
                sx={{ cursor: onRowClick ? 'pointer' : 'default' }}
              >
                {columns.map((column) => {
                  const value = row[column.id];
                  return (
                    <TableCell key={String(column.id)} align={column.align}>
                      {column.format ? column.format(value, row) : String(value ?? '-')}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        component="div"
        count={totalRows}
        page={page}
        onPageChange={(_, newPage) => onPageChange(newPage)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(e) => onRowsPerPageChange(parseInt(e.target.value, 10))}
        rowsPerPageOptions={[20, 50, 100]}
        labelRowsPerPage="Filas por página:"
      />
    </Paper>
  );
}
```

**`src/components/common/StatCard.tsx`:**
```typescript
import { Card, CardContent, Typography, Box } from '@mui/material';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color?: string;
  trend?: {
    value: number;
    label: string;
  };
}

export default function StatCard({ title, value, icon, color = 'primary.main', trend }: StatCardProps) {
  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography color="textSecondary" variant="body2" gutterBottom>
              {title}
            </Typography>
            <Typography variant="h4" component="div" sx={{ fontWeight: 600, color }}>
              {value}
            </Typography>
            {trend && (
              <Typography
                variant="caption"
                color={trend.value >= 0 ? 'success.main' : 'error.main'}
                sx={{ mt: 1 }}
              >
                {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}% {trend.label}
              </Typography>
            )}
          </Box>
          <Box
            sx={{
              backgroundColor: color,
              borderRadius: '50%',
              width: 56,
              height: 56,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
            }}
          >
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
```

---

## 4. Admin Authentication & Authorization

### 4.1 JWT Payload Structure

```typescript
interface AdminJWTPayload {
  id: number;
  role: 'admin';
  is_super: boolean;
  iat: number;
  exp: number;
}
```

### 4.2 Backend Middleware Implementation

**`backend/src/middleware/requireAdmin.ts`:**
```typescript
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';

interface AdminJWTPayload {
  id: number;
  role: 'admin';
  is_super: boolean;
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      admin?: {
        id: number;
        is_super: boolean;
      };
    }
  }
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.substring(7);
    const payload = jwt.verify(token, process.env.ADMIN_JWT_SECRET!) as AdminJWTPayload;

    if (payload.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const admin = await prisma.admin.findUnique({
      where: { id: payload.id },
      select: { id: true, is_active: true, is_super_admin: true },
    });

    if (!admin || !admin.is_active) {
      return res.status(403).json({ error: 'Admin account inactive' });
    }

    req.admin = { id: admin.id, is_super: admin.is_super_admin };
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.admin?.is_super) {
    return res.status(403).json({ error: 'Super admin access required' });
  }
  next();
}
```

### 4.3 Rate Limiting Configuration

**`backend/src/middleware/rateLimiter.ts`:**
```typescript
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { createClient } from 'redis';

const redisClient = createClient({
  url: process.env.REDIS_URL,
});

redisClient.connect().catch(console.error);

export const adminLoginLimiter = rateLimit({
  store: new RedisStore({
    client: redisClient,
    prefix: 'rate_limit:admin_login:',
  }),
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5, // 5 attempts
  message: 'Too many login attempts. Please try again in 10 minutes.',
  standardHeaders: true,
  legacyHeaders: false,
});

export const adminActionLimiter = rateLimit({
  store: new RedisStore({
    client: redisClient,
    prefix: 'rate_limit:admin_action:',
  }),
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests
  message: 'Too many requests. Please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.admin?.id.toString() || req.ip, // Per admin
});
```

### 4.4 Password Validation (Zod Schema)

**`backend/src/schemas/adminSchema.ts`:**
```typescript
import { z } from 'zod';

export const adminPasswordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

export const adminCreateSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: adminPasswordSchema,
  full_name: z.string().min(3, 'Full name must be at least 3 characters'),
});

export const adminLoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});
```

### 4.5 Admin Login Endpoint

**`backend/src/routes/admin/auth.ts`:**
```typescript
import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../../lib/prisma';
import { adminLoginSchema, adminCreateSchema } from '../../schemas/adminSchema';
import { adminLoginLimiter } from '../../middleware/rateLimiter';
import { requireAdmin, requireSuperAdmin } from '../../middleware/requireAdmin';

const router = Router();

// POST /api/admin/login
router.post('/login', adminLoginLimiter, async (req, res) => {
  try {
    const { email, password } = adminLoginSchema.parse(req.body);

    const admin = await prisma.admin.findUnique({ where: { email } });
    if (!admin || !admin.is_active) {
      // Log failed attempt
      await prisma.adminLoginAttempt.create({
        data: {
          email,
          ip_address: req.ip,
          success: false,
        },
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, admin.password_hash);
    if (!valid) {
      await prisma.adminLoginAttempt.create({
        data: {
          email,
          ip_address: req.ip,
          success: false,
        },
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Log successful attempt
    await prisma.adminLoginAttempt.create({
      data: {
        email,
        ip_address: req.ip,
        success: true,
        admin_id: admin.id,
      },
    });

    const token = jwt.sign(
      { id: admin.id, role: 'admin', is_super: admin.is_super_admin },
      process.env.ADMIN_JWT_SECRET!,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        full_name: admin.full_name,
        is_super_admin: admin.is_super_admin,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/me
router.get('/me', requireAdmin, async (req, res) => {
  const admin = await prisma.admin.findUnique({
    where: { id: req.admin!.id },
    select: {
      id: true,
      email: true,
      full_name: true,
      is_super_admin: true,
    },
  });
  res.json({ admin });
});

// POST /api/admin/admins/create (super admin only)
router.post('/admins/create', requireAdmin, requireSuperAdmin, async (req, res) => {
  try {
    const { email, password, full_name } = adminCreateSchema.parse(req.body);

    // Check if email already exists
    const existing = await prisma.admin.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 12);

    // Create admin
    const admin = await prisma.admin.create({
      data: {
        email,
        password_hash,
        full_name,
        is_super_admin: false,
        is_active: true,
      },
      select: {
        id: true,
        email: true,
        full_name: true,
        is_super_admin: true,
        created_at: true,
      },
    });

    // Log action
    await prisma.adminAction.create({
      data: {
        admin_id: req.admin!.id,
        action_type: 'create_admin',
        entity_type: 'admin',
        entity_id: admin.id,
        details: { email, full_name },
      },
    });

    res.status(201).json({ admin });
  } catch (error) {
    console.error('Create admin error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
```

---

## 5. Dashboard Analytics

### 5.1 KPI Calculation SQL Queries

**`backend/src/services/analyticsService.ts`:**
```typescript
import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';
import { redisClient } from '../lib/redis';

export async function getDashboardKPIs(timeRange: 'today' | 'week' | 'month' | 'year') {
  const cacheKey = `admin:analytics:kpis:${timeRange}`;
  
  // Check cache
  const cached = await redisClient.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  const { startDate, endDate } = getDateRange(timeRange);

  // Total users count
  const totalUsers = await prisma.user.count();

  // Active professionals (≥1 completed appointment last 30 days)
  const activeProfessionals = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(DISTINCT p.id) as count
    FROM professionals p
    JOIN appointments a ON a.proposal_id IN (
      SELECT id FROM proposals WHERE professional_id = p.id
    )
    WHERE a.status = 'completed'
      AND a.updated_at >= NOW() - INTERVAL '30 days'
  `;

  // Current month GMV
  const monthlyGMVResult = await prisma.payment.aggregate({
    where: {
      status: 'completed',
      created_at: {
        gte: startDate,
        lt: endDate,
      },
    },
    _sum: {
      amount: true,
    },
    _count: true,
  });

  const kpis = {
    totalUsers,
    activeProfessionals: Number(activeProfessionals[0].count),
    monthlyGMV: monthlyGMVResult._sum.amount?.toNumber() || 0,
    monthlyTransactions: monthlyGMVResult._count,
  };

  // Cache for 5 minutes
  await redisClient.setEx(cacheKey, 300, JSON.stringify(kpis));

  return kpis;
}

function getDateRange(timeRange: string) {
  const now = new Date();
  let startDate: Date;
  let endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59); // End of current month

  switch (timeRange) {
    case 'today':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      break;
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      endDate = now;
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
      break;
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  return { startDate, endDate };
}

export async function getRegistrationsPerDay(timeRange: string) {
  const { startDate, endDate } = getDateRange(timeRange);

  const registrations = await prisma.$queryRaw<Array<{ date: Date; count: bigint }>>`
    SELECT DATE(created_at) as date, COUNT(*) as count
    FROM users
    WHERE created_at >= ${startDate}
      AND created_at < ${endDate}
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `;

  return registrations.map((r) => ({
    date: r.date.toISOString().split('T')[0],
    count: Number(r.count),
  }));
}

export async function getTransactionsPerDay(timeRange: string) {
  const { startDate, endDate } = getDateRange(timeRange);

  const transactions = await prisma.$queryRaw<Array<{ date: Date; count: bigint; total: Prisma.Decimal }>>`
    SELECT 
      DATE(created_at) as date,
      COUNT(*) as count,
      SUM(amount) as total
    FROM payments
    WHERE status = 'completed'
      AND created_at >= ${startDate}
      AND created_at < ${endDate}
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `;

  return transactions.map((t) => ({
    date: t.date.toISOString().split('T')[0],
    count: Number(t.count),
    total: t.total.toNumber(),
  }));
}

export async function getConversionFunnel(timeRange: string) {
  const { startDate, endDate } = getDateRange(timeRange);

  const [registrations, posts, proposals, payments, completed] = await Promise.all([
    prisma.user.count({
      where: { created_at: { gte: startDate, lt: endDate } },
    }),
    prisma.post.count({
      where: { created_at: { gte: startDate, lt: endDate } },
    }),
    prisma.proposal.count({
      where: { created_at: { gte: startDate, lt: endDate } },
    }),
    prisma.payment.count({
      where: {
        status: 'completed',
        created_at: { gte: startDate, lt: endDate },
      },
    }),
    prisma.appointment.count({
      where: {
        status: 'completed',
        updated_at: { gte: startDate, lt: endDate },
      },
    }),
  ]);

  return {
    registrations,
    posts,
    proposals,
    payments,
    completed,
  };
}

export async function getTopProfessionals(limit: number = 5) {
  const topProfessionals = await prisma.$queryRaw<
    Array<{
      id: number;
      name: string;
      rating: Prisma.Decimal;
      completed_jobs: bigint;
      total_reviews: bigint;
    }>
  >`
    SELECT 
      u.id,
      u.full_name as name,
      u.rating,
      COUNT(DISTINCT a.id) as completed_jobs,
      COUNT(DISTINCT r.id) as total_reviews
    FROM users u
    JOIN professionals p ON u.id = p.user_id
    JOIN proposals pr ON p.id = pr.professional_id
    JOIN appointments a ON pr.id = a.proposal_id
    LEFT JOIN reviews r ON u.id = r.reviewed_id
    WHERE a.status = 'completed'
      AND a.updated_at >= NOW() - INTERVAL '30 days'
    GROUP BY u.id
    HAVING COUNT(DISTINCT r.id) >= 20
    ORDER BY u.rating DESC, completed_jobs DESC
    LIMIT ${limit}
  `;

  return topProfessionals.map((p) => ({
    id: p.id,
    name: p.name,
    rating: p.rating.toNumber(),
    completedJobs: Number(p.completed_jobs),
    totalReviews: Number(p.total_reviews),
  }));
}
```

### 5.2 Dashboard Endpoint

**`backend/src/routes/admin/analytics.ts`:**
```typescript
import { Router } from 'express';
import { requireAdmin } from '../../middleware/requireAdmin';
import * as analyticsService from '../../services/analyticsService';

const router = Router();

// GET /api/admin/analytics/dashboard
router.get('/dashboard', requireAdmin, async (req, res) => {
  try {
    const timeRange = (req.query.timeRange as string) || 'month';

    const [kpis, registrations, transactions, funnel, topProfessionals] = await Promise.all([
      analyticsService.getDashboardKPIs(timeRange),
      analyticsService.getRegistrationsPerDay(timeRange),
      analyticsService.getTransactionsPerDay(timeRange),
      analyticsService.getConversionFunnel(timeRange),
      analyticsService.getTopProfessionals(5),
    ]);

    res.json({
      kpis,
      charts: {
        registrationsPerDay: registrations,
        transactionsPerDay: transactions,
      },
      conversionFunnel: funnel,
      topProfessionals,
    });
  } catch (error) {
    console.error('Dashboard analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
```

### 5.3 React Query Hook for Dashboard

**`src/hooks/useAdminDashboard.ts`:**
```typescript
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';

export interface DashboardKPIs {
  totalUsers: number;
  activeProfessionals: number;
  monthlyGMV: number;
  monthlyTransactions: number;
}

export interface ChartData {
  registrationsPerDay: Array<{ date: string; count: number }>;
  transactionsPerDay: Array<{ date: string; count: number; total: number }>;
}

export interface ConversionFunnel {
  registrations: number;
  posts: number;
  proposals: number;
  payments: number;
  completed: number;
}

export interface TopProfessional {
  id: number;
  name: string;
  rating: number;
  completedJobs: number;
  totalReviews: number;
}

export interface DashboardData {
  kpis: DashboardKPIs;
  charts: ChartData;
  conversionFunnel: ConversionFunnel;
  topProfessionals: TopProfessional[];
}

export function useAdminDashboard(timeRange: 'today' | 'week' | 'month' | 'year') {
  return useQuery({
    queryKey: ['admin', 'dashboard', timeRange],
    queryFn: async () => {
      const response = await apiClient.get<DashboardData>('/admin/analytics/dashboard', {
        params: { timeRange },
      });
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes (matches Redis cache TTL)
    refetchOnWindowFocus: false,
  });
}
```

### 5.4 Dashboard Page Component

**`src/pages/Dashboard.tsx`:**
```typescript
import { useState } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Box,
  CircularProgress,
} from '@mui/material';
import {
  People as PeopleIcon,
  Work as WorkIcon,
  AttachMoney as MoneyIcon,
  ShoppingCart as CartIcon,
} from '@mui/icons-material';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import StatCard from '../components/common/StatCard';
import { useAdminDashboard } from '../hooks/useAdminDashboard';

export default function Dashboard() {
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month' | 'year'>('month');
  const { data, isLoading, error } = useAdminDashboard(timeRange);

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={4}>
        <Typography color="error">Error loading dashboard data</Typography>
      </Box>
    );
  }

  if (!data) return null;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Typography variant="h4" fontWeight={600}>
          Dashboard Analytics
        </Typography>
        <FormControl sx={{ minWidth: 150 }}>
          <InputLabel>Time Range</InputLabel>
          <Select value={timeRange} onChange={(e) => setTimeRange(e.target.value as any)} label="Time Range">
            <MenuItem value="today">Today</MenuItem>
            <MenuItem value="week">Last Week</MenuItem>
            <MenuItem value="month">This Month</MenuItem>
            <MenuItem value="year">This Year</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* KPI Cards */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Users"
            value={data.kpis.totalUsers.toLocaleString()}
            icon={<PeopleIcon />}
            color="primary.main"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Active Professionals"
            value={data.kpis.activeProfessionals}
            icon={<WorkIcon />}
            color="success.main"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Monthly GMV"
            value={formatCurrency(data.kpis.monthlyGMV)}
            icon={<MoneyIcon />}
            color="warning.main"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Monthly Transactions"
            value={data.kpis.monthlyTransactions}
            icon={<CartIcon />}
            color="secondary.main"
          />
        </Grid>
      </Grid>

      {/* Charts */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" mb={2}>
                Registrations per Day
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data.charts.registrationsPerDay}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="count" stroke="#1976d2" name="Registrations" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" mb={2}>
                Transactions per Day
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.charts.transactionsPerDay}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" fill="#2e7d32" name="Transactions" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Conversion Funnel & Top Professionals */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" mb={2}>
                Conversion Funnel
              </Typography>
              <Box>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography>Registrations</Typography>
                  <Typography fontWeight={600}>{data.conversionFunnel.registrations}</Typography>
                </Box>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography>Posts Created</Typography>
                  <Typography fontWeight={600}>{data.conversionFunnel.posts}</Typography>
                </Box>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography>Proposals Sent</Typography>
                  <Typography fontWeight={600}>{data.conversionFunnel.proposals}</Typography>
                </Box>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography>Payments Made</Typography>
                  <Typography fontWeight={600}>{data.conversionFunnel.payments}</Typography>
                </Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography>Jobs Completed</Typography>
                  <Typography fontWeight={600}>{data.conversionFunnel.completed}</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" mb={2}>
                Top 5 Professionals
              </Typography>
              {data.topProfessionals.map((pro, index) => (
                <Box key={pro.id} display="flex" justifyContent="space-between" mb={2}>
                  <Box>
                    <Typography fontWeight={600}>
                      {index + 1}. {pro.name}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {pro.completedJobs} jobs · {pro.totalReviews} reviews
                    </Typography>
                  </Box>
                  <Typography fontWeight={600} color="warning.main">
                    ⭐ {pro.rating.toFixed(2)}
                  </Typography>
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
```

---

## 6. OCR Pipeline (Tesseract.js + Bull Queue)

### 6.1 Bull Queue Configuration

**`backend/src/lib/queue.ts`:**
```typescript
import Bull from 'bull';

export const certificationOCRQueue = new Bull('certification-ocr', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000, // 5s, 10s, 20s
    },
    timeout: 120000, // 2 minutes
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 500, // Keep last 500 failed jobs
  },
});

// Monitor queue events
certificationOCRQueue.on('completed', (job, result) => {
  console.log(`[OCR Queue] Job ${job.id} completed:`, result);
});

certificationOCRQueue.on('failed', (job, err) => {
  console.error(`[OCR Queue] Job ${job?.id} failed:`, err.message);
});

certificationOCRQueue.on('stalled', (job) => {
  console.warn(`[OCR Queue] Job ${job.id} stalled`);
});
```

### 6.2 Sharp Preprocessing Pipeline

**`backend/src/services/imagePreprocessing.ts`:**
```typescript
import sharp from 'sharp';

export async function preprocessForOCR(inputBuffer: Buffer): Promise<Buffer> {
  try {
    return await sharp(inputBuffer)
      // 1. Convert to grayscale (removes color noise)
      .grayscale()
      // 2. Resize to optimal width (2000px is Tesseract sweet spot)
      .resize(2000, null, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      // 3. Normalize contrast (spreads histogram)
      .normalize()
      // 4. Sharpen edges (enhances text boundaries)
      .sharpen({ sigma: 1.5 })
      // 5. Binary threshold (pure black/white for OCR)
      .threshold(128, { grayscale: false })
      // 6. Output as PNG buffer
      .png()
      .toBuffer();
  } catch (error) {
    console.error('Sharp preprocessing error:', error);
    throw new Error('Image preprocessing failed');
  }
}

export async function validateImageDPI(inputBuffer: Buffer): Promise<number> {
  const metadata = await sharp(inputBuffer).metadata();
  const dpi = metadata.density || 72; // Default to 72 if not available
  return dpi;
}
```

### 6.3 PDF to PNG Conversion

**`backend/src/services/pdfService.ts`:**
```typescript
import { convert } from 'pdf-poppler';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export async function convertPDFToImages(pdfBuffer: Buffer): Promise<Buffer[]> {
  const tempDir = path.join(os.tmpdir(), `pdf-${Date.now()}`);
  await fs.mkdir(tempDir, { recursive: true });

  const pdfPath = path.join(tempDir, 'input.pdf');
  await fs.writeFile(pdfPath, pdfBuffer);

  try {
    const options = {
      format: 'png',
      out_dir: tempDir,
      out_prefix: 'page',
      page: null, // Convert all pages
    };

    await convert(pdfPath, options);

    // Read all generated PNG files
    const files = await fs.readdir(tempDir);
    const pngFiles = files.filter((f) => f.startsWith('page') && f.endsWith('.png')).sort();

    const imageBuffers = await Promise.all(
      pngFiles.map((filename) => fs.readFile(path.join(tempDir, filename)))
    );

    // Cleanup
    await fs.rm(tempDir, { recursive: true, force: true });

    return imageBuffers;
  } catch (error) {
    // Cleanup on error
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}
```

### 6.4 Tesseract OCR Worker

**`backend/src/workers/certificationOCR.worker.ts`:**
```typescript
import { Job } from 'bull';
import Tesseract from 'tesseract.js';
import axios from 'axios';
import { prisma } from '../lib/prisma';
import { certificationOCRQueue } from '../lib/queue';
import { convertPDFToImages } from '../services/pdfService';
import { preprocessForOCR, validateImageDPI } from '../services/imagePreprocessing';
import { parseCertificationFields } from '../services/certificationParser';

interface OCRJobData {
  certificationId: number;
  imageUrl: string;
  certificationType: string;
}

// Start processing jobs (concurrency: 2)
certificationOCRQueue.process(2, processOCRJob);

async function processOCRJob(job: Job<OCRJobData>) {
  const { certificationId, imageUrl, certificationType } = job.data;
  const startTime = Date.now();

  try {
    console.log(`[OCR Worker] Processing certification ${certificationId}`);

    // 1. Download file from Cloudinary
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const fileBuffer = Buffer.from(response.data);

    // 2. Handle PDF (convert to PNG) or use image directly
    let imageBuffers: Buffer[];
    if (imageUrl.endsWith('.pdf')) {
      console.log(`[OCR Worker] Converting PDF to images`);
      imageBuffers = await convertPDFToImages(fileBuffer);
      console.log(`[OCR Worker] Converted PDF to ${imageBuffers.length} pages`);
    } else {
      // Validate DPI for images
      const dpi = await validateImageDPI(fileBuffer);
      if (dpi < 300) {
        throw new Error(`Image DPI too low (${dpi}). Minimum 300 required.`);
      }
      imageBuffers = [fileBuffer];
    }

    // 3. Preprocess images with sharp
    console.log(`[OCR Worker] Preprocessing ${imageBuffers.length} images`);
    const preprocessedBuffers = await Promise.all(imageBuffers.map(preprocessForOCR));

    // 4. Run Tesseract OCR on each page
    console.log(`[OCR Worker] Running OCR on ${preprocessedBuffers.length} pages`);
    const ocrResults = await Promise.all(
      preprocessedBuffers.map((buffer) => runTesseract(buffer))
    );

    // 5. Combine text from all pages
    const combinedText = ocrResults.map((r) => r.text).join('\n');
    const avgConfidence = ocrResults.reduce((sum, r) => sum + r.confidence, 0) / ocrResults.length;

    console.log(`[OCR Worker] OCR completed with ${avgConfidence.toFixed(2)}% confidence`);

    // 6. Parse fields with regex
    const extractedFields = await parseCertificationFields(combinedText, certificationType);

    // 7. Store result in database
    await prisma.certification.update({
      where: { id: certificationId },
      data: {
        ocr_data: {
          raw_text: combinedText,
          confidence: Math.round(avgConfidence),
          extracted_fields: extractedFields,
          processing_time_ms: Date.now() - startTime,
          processed_at: new Date(),
        },
        confidence_score: Math.round(avgConfidence),
        certification_number: extractedFields.number || null,
        issue_date: extractedFields.issue_date ? new Date(extractedFields.issue_date) : null,
        expiry_date: extractedFields.expiry_date ? new Date(extractedFields.expiry_date) : null,
      },
    });

    console.log(
      `[OCR Worker] Certification ${certificationId} updated (${Date.now() - startTime}ms)`
    );

    // 8. Send FCM notification if low confidence
    if (avgConfidence < 60) {
      // TODO: Send notification "Certificación procesada con baja confianza"
    }

    return {
      success: true,
      confidence: avgConfidence,
      extractedFields,
      processingTime: Date.now() - startTime,
    };
  } catch (error: any) {
    console.error(`[OCR Worker] Error processing certification ${certificationId}:`, error);

    // Update certification with error
    await prisma.certification.update({
      where: { id: certificationId },
      data: {
        ocr_data: {
          error: error.message,
          failed_at: new Date(),
        },
      },
    });

    throw error; // Bull will retry
  }
}

async function runTesseract(imageBuffer: Buffer): Promise<{ text: string; confidence: number }> {
  const worker = await Tesseract.createWorker('spa', 1, {
    // logger: (m) => console.log('[Tesseract]', m), // Uncomment for debugging
  });

  const {
    data: { text, confidence },
  } = await worker.recognize(imageBuffer, {
    tessedit_pageseg_mode: Tesseract.PSM.AUTO,
  });

  await worker.terminate();

  return { text, confidence };
}
```

### 6.5 Regex Parser Function

**`backend/src/services/certificationParser.ts`:**
```typescript
import { prisma } from '../lib/prisma';

interface ExtractedFields {
  type?: string;
  number?: string;
  issue_date?: string;
  expiry_date?: string;
  holder_name?: string;
}

export async function parseCertificationFields(
  text: string,
  certificationType: string
): Promise<ExtractedFields> {
  // Fetch regex patterns from database
  const patterns = await prisma.certificationPattern.findMany({
    where: {
      certification_type: certificationType,
      is_active: true,
    },
  });

  const extracted: ExtractedFields = { type: certificationType };

  for (const pattern of patterns) {
    const regex = new RegExp(pattern.regex_pattern, 'i');
    const match = text.match(regex);

    if (match && match[1]) {
      const value = match[1].trim();

      if (pattern.field_name === 'number') {
        extracted.number = value;
      } else if (pattern.field_name === 'expiry_date') {
        extracted.expiry_date = convertDateToISO(value);
      } else if (pattern.field_name === 'issue_date') {
        extracted.issue_date = convertDateToISO(value);
      } else if (pattern.field_name === 'holder_name') {
        extracted.holder_name = value;
      }
    }
  }

  return extracted;
}

function convertDateToISO(dateStr: string): string | undefined {
  // Handle DD/MM/YYYY or DD-MM-YYYY
  const match = dateStr.match(/(\d{2})[-/](\d{2})[-/](\d{4})/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month}-${day}`;
  }
  return undefined;
}
```

### 6.6 Professional Upload Endpoint (Trigger OCR)

**`backend/src/routes/professionals.ts` (modification):**
```typescript
import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/requireAuth';
import { certificationOCRQueue } from '../lib/queue';
import { uploadToCloudinary } from '../services/cloudinary';
import { validateImageDPI } from '../services/imagePreprocessing';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB
const router = Router();

// POST /api/professionals/me/certifications
router.post('/me/certifications', requireAuth, upload.single('file'), async (req, res) => {
  try {
    const { certification_type } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'File is required' });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(file.mimetype)) {
      return res.status(400).json({ error: 'Invalid file type. Only JPEG, PNG, PDF allowed.' });
    }

    // Validate DPI for images (skip for PDF)
    if (file.mimetype.startsWith('image/')) {
      const dpi = await validateImageDPI(file.buffer);
      if (dpi < 300) {
        return res.status(400).json({
          error: 'Image quality too low',
          message: `Image DPI (${dpi}) is below minimum 300. Please take a high-quality photo or scan.`,
        });
      }
    }

    // Upload to Cloudinary
    const cloudinaryUrl = await uploadToCloudinary(file.buffer, 'certifications');

    // Get professional_id
    const professional = await prisma.professional.findUnique({
      where: { user_id: req.userId! },
    });

    if (!professional) {
      return res.status(404).json({ error: 'Professional profile not found' });
    }

    // Create certification record
    const certification = await prisma.certification.create({
      data: {
        professional_id: professional.id,
        certification_type,
        document_url: cloudinaryUrl,
        status: 'pending',
      },
    });

    // Enqueue OCR job
    await certificationOCRQueue.add(
      {
        certificationId: certification.id,
        imageUrl: cloudinaryUrl,
        certificationType: certification_type,
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        timeout: 120000,
      }
    );

    res.status(201).json({
      certification,
      message: 'Certificación subida exitosamente. Procesando con OCR...',
    });
  } catch (error) {
    console.error('Upload certification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
```

---

## 7. Certification Management UI

### 7.1 List View Component

**`src/pages/Certifications/CertificationList.tsx`:**
```typescript
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Badge,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { DataTable } from '../../components/common/DataTable';
import { apiClient } from '../../api/client';
import { format } from 'date-fns';

interface Certification {
  id: number;
  professional: {
    id: number;
    user: {
      full_name: string;
    };
  };
  certification_type: string;
  certification_number: string | null;
  confidence_score: number | null;
  status: string;
  created_at: string;
}

export default function CertificationList() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);

  const { data, isLoading } = useQuery({
    queryKey: ['certifications', status, page, rowsPerPage],
    queryFn: async () => {
      const response = await apiClient.get('/admin/certifications', {
        params: {
          status,
          cursor: page * rowsPerPage,
          limit: rowsPerPage,
        },
      });
      return response.data;
    },
  });

  const columns = [
    {
      id: 'professional',
      label: 'Professional',
      format: (value: any) => value.user.full_name,
    },
    {
      id: 'certification_type',
      label: 'Type',
    },
    {
      id: 'certification_number',
      label: 'Number (OCR)',
      format: (value: string | null) => value || '-',
    },
    {
      id: 'confidence_score',
      label: 'Confidence',
      align: 'center' as const,
      format: (value: number | null) => {
        if (!value) return '-';
        const color = value >= 80 ? 'success' : value >= 60 ? 'warning' : 'error';
        return (
          <Chip
            label={`${value}%`}
            color={color}
            size="small"
            icon={value < 60 ? <Badge badgeContent="!" color="error" /> : undefined}
          />
        );
      },
    },
    {
      id: 'created_at',
      label: 'Upload Date',
      format: (value: string) => format(new Date(value), 'dd/MM/yyyy HH:mm'),
    },
    {
      id: 'status',
      label: 'Status',
      format: (value: string) => {
        const colorMap: Record<string, 'default' | 'warning' | 'success' | 'error'> = {
          pending: 'warning',
          approved: 'success',
          rejected: 'error',
        };
        return <Chip label={value.toUpperCase()} color={colorMap[value] || 'default'} size="small" />;
      },
    },
  ];

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight={600}>
          Certification Management
        </Typography>
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel>Status</InputLabel>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} label="Status">
            <MenuItem value="pending">Pending</MenuItem>
            <MenuItem value="approved">Approved</MenuItem>
            <MenuItem value="rejected">Rejected</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <DataTable
        columns={columns}
        rows={data?.certifications || []}
        loading={isLoading}
        page={page}
        rowsPerPage={rowsPerPage}
        totalRows={data?.total || 0}
        onPageChange={setPage}
        onRowsPerPageChange={(newRowsPerPage) => {
          setRowsPerPage(newRowsPerPage);
          setPage(0);
        }}
        onRowClick={(row) => navigate(`/admin/certifications/${row.id}`)}
      />
    </Box>
  );
}
```

### 7.2 Detail View with Image Viewer and Editable Fields

**`src/pages/Certifications/CertificationDetail.tsx`:**
```typescript
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { format } from 'date-fns';

export default function CertificationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [editedFields, setEditedFields] = useState<any>({});
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['certification', id],
    queryFn: async () => {
      const response = await apiClient.get(`/admin/certifications/${id}`);
      return response.data;
    },
    onSuccess: (data) => {
      // Initialize edited fields
      setEditedFields({
        number: data.certification_number || data.ocr_data?.extracted_fields?.number || '',
        issue_date: data.issue_date || data.ocr_data?.extracted_fields?.issue_date || '',
        expiry_date: data.expiry_date || data.ocr_data?.extracted_fields?.expiry_date || '',
      });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      return apiClient.post(`/admin/certifications/${id}/approve`, { edited_fields: editedFields });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['certification', id]);
      queryClient.invalidateQueries(['certifications']);
      navigate('/admin/certifications');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (reason: string) => {
      return apiClient.post(`/admin/certifications/${id}/reject`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['certification', id]);
      queryClient.invalidateQueries(['certifications']);
      navigate('/admin/certifications');
    },
  });

  if (isLoading || !data) {
    return <Box p={3}>Loading...</Box>;
  }

  const { certification, professional } = data;
  const ocrData = certification.ocr_data;
  const confidence = ocrData?.confidence || 0;

  return (
    <Box p={3}>
      <Typography variant="h4" fontWeight={600} mb={3}>
        Certification Review
      </Typography>

      <Grid container spacing={3}>
        {/* Left: Image Viewer */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" mb={2}>
                Document Image
              </Typography>
              <Box
                component="img"
                src={certification.document_url}
                alt="Certification"
                sx={{
                  width: '100%',
                  maxHeight: 600,
                  objectFit: 'contain',
                  border: '1px solid #ddd',
                  borderRadius: 2,
                }}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Right: OCR Data & Editable Fields */}
        <Grid item xs={12} md={6}>
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" mb={2}>
                Professional Info
              </Typography>
              <Typography>
                <strong>Name:</strong> {professional.user.full_name}
              </Typography>
              <Typography>
                <strong>Email:</strong> {professional.user.email}
              </Typography>
              <Typography>
                <strong>Phone:</strong> {professional.user.phone}
              </Typography>
            </CardContent>
          </Card>

          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">OCR Results</Typography>
                <Chip
                  label={`Confidence: ${confidence}%`}
                  color={confidence >= 80 ? 'success' : confidence >= 60 ? 'warning' : 'error'}
                />
              </Box>

              <TextField
                fullWidth
                label="Certification Type"
                value={certification.certification_type}
                disabled
                sx={{ mb: 2 }}
              />

              <TextField
                fullWidth
                label="Certification Number"
                value={editedFields.number}
                onChange={(e) => setEditedFields({ ...editedFields, number: e.target.value })}
                helperText="Edit if OCR extracted incorrectly"
                sx={{ mb: 2 }}
              />

              <TextField
                fullWidth
                label="Issue Date (YYYY-MM-DD)"
                value={editedFields.issue_date}
                onChange={(e) => setEditedFields({ ...editedFields, issue_date: e.target.value })}
                sx={{ mb: 2 }}
              />

              <TextField
                fullWidth
                label="Expiry Date (YYYY-MM-DD)"
                value={editedFields.expiry_date}
                onChange={(e) => setEditedFields({ ...editedFields, expiry_date: e.target.value })}
                sx={{ mb: 2 }}
              />

              {ocrData?.raw_text && (
                <TextField
                  fullWidth
                  label="Raw OCR Text"
                  value={ocrData.raw_text}
                  multiline
                  rows={6}
                  disabled
                  sx={{ mb: 2 }}
                />
              )}
            </CardContent>
          </Card>

          {certification.status === 'pending' && (
            <Box display="flex" gap={2}>
              <Button
                variant="contained"
                color="success"
                fullWidth
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isLoading}
              >
                {approveMutation.isLoading ? 'Approving...' : 'Approve Certification'}
              </Button>
              <Button
                variant="contained"
                color="error"
                fullWidth
                onClick={() => setRejectDialogOpen(true)}
              >
                Reject
              </Button>
            </Box>
          )}
        </Grid>
      </Grid>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onClose={() => setRejectDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Reject Certification</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Rejection Reason"
            multiline
            rows={4}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              rejectMutation.mutate(rejectReason);
              setRejectDialogOpen(false);
            }}
            disabled={!rejectReason || rejectMutation.isLoading}
          >
            Confirm Reject
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
```

---

## 8. Dispute Resolution System

### 8.1 Backend MercadoPago Refund Integration

**`backend/src/services/mercadopagoService.ts`:**
```typescript
import axios from 'axios';

interface RefundResponse {
  id: number;
  payment_id: number;
  amount: number;
  status: string; // 'approved', 'pending', 'rejected'
}

export async function createRefund(paymentId: string, amount: number): Promise<RefundResponse> {
  try {
    const response = await axios.post(
      `https://api.mercadopago.com/v1/payments/${paymentId}/refunds`,
      { amount },
      {
        headers: {
          Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data;
  } catch (error: any) {
    console.error('MercadoPago refund error:', error.response?.data);
    throw new Error(`Refund failed: ${error.response?.data?.message || error.message}`);
  }
}
```

### 8.2 Dispute Resolution Endpoints

**`backend/src/routes/admin/disputes.ts`:**
```typescript
import { Router } from 'express';
import { requireAdmin } from '../../middleware/requireAdmin';
import { prisma } from '../../lib/prisma';
import { createRefund } from '../../services/mercadopagoService';
import { sendPushNotification } from '../../services/fcmService';

const router = Router();

// GET /api/admin/disputes
router.get('/', requireAdmin, async (req, res) => {
  try {
    const { status = 'open', type, cursor = '0', limit = '20' } = req.query;

    const disputes = await prisma.dispute.findMany({
      where: {
        status: status === 'all' ? undefined : (status as string),
        reason: type ? (type as string) : undefined,
      },
      include: {
        reporter: { select: { id: true, full_name: true, email: true } },
        appointment: {
          include: {
            proposal: {
              include: {
                professional: { include: { user: true } },
                post: { include: { user: true } },
              },
            },
            payment: true,
          },
        },
      },
      orderBy: { created_at: 'asc' }, // Oldest first (FIFO)
      skip: parseInt(cursor as string),
      take: parseInt(limit as string),
    });

    const total = await prisma.dispute.count({
      where: { status: status === 'all' ? undefined : (status as string) },
    });

    res.json({ disputes, total, nextCursor: disputes.length === parseInt(limit as string) ? parseInt(cursor as string) + parseInt(limit as string) : null });
  } catch (error) {
    console.error('Get disputes error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/disputes/:id
router.get('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const dispute = await prisma.dispute.findUnique({
      where: { id: parseInt(id) },
      include: {
        reporter: true,
        appointment: {
          include: {
            proposal: {
              include: {
                professional: { include: { user: true } },
                post: { include: { user: true } },
              },
            },
            payment: true,
          },
        },
      },
    });

    if (!dispute) {
      return res.status(404).json({ error: 'Dispute not found' });
    }

    // Fetch chat history
    const chatHistory = await prisma.message.findMany({
      where: {
        chat: {
          OR: [
            { client_id: dispute.reporter_id, professional_id: dispute.appointment.proposal.professional_id },
            { client_id: dispute.appointment.proposal.professional_id, professional_id: dispute.reporter_id },
          ],
        },
      },
      include: { sender: { select: { id: true, full_name: true, profile_photo_url: true } } },
      orderBy: { created_at: 'asc' },
      take: 100,
    });

    res.json({ dispute, chatHistory });
  } catch (error) {
    console.error('Get dispute detail error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/disputes/:id/refund-total
router.post('/:id/refund-total', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { admin_notes } = req.body;

    const dispute = await prisma.dispute.findUnique({
      where: { id: parseInt(id) },
      include: { appointment: { include: { payment: true, proposal: { include: { post: { include: { user: true } } } } } } },
    });

    if (!dispute) {
      return res.status(404).json({ error: 'Dispute not found' });
    }

    if (dispute.status !== 'investigating') {
      return res.status(400).json({ error: 'Dispute not in investigating status' });
    }

    const payment = dispute.appointment.payment;
    if (!payment) {
      return res.status(400).json({ error: 'Payment not found' });
    }

    // Execute refund via MercadoPago
    const refund = await createRefund(payment.mercadopago_payment_id!, payment.amount.toNumber());

    // Update database in transaction
    await prisma.$transaction([
      // Update payment status
      prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'refunded' },
      }),

      // Create refund record
      prisma.refund.create({
        data: {
          payment_id: payment.id,
          amount: payment.amount,
          reason: 'dispute_resolved_refund',
          mercadopago_refund_id: refund.id.toString(),
          status: 'completed',
          completed_at: new Date(),
        },
      }),

      // Update dispute
      prisma.dispute.update({
        where: { id: dispute.id },
        data: {
          status: 'resolved_refund',
          admin_notes,
          resolved_at: new Date(),
        },
      }),

      // Log admin action
      prisma.adminAction.create({
        data: {
          admin_id: req.admin!.id,
          action_type: 'refund_total',
          entity_type: 'dispute',
          entity_id: dispute.id,
          details: { amount: payment.amount.toNumber(), reason: admin_notes, payment_id: payment.id },
        },
      }),
    ]);

    // Send FCM notifications
    await sendPushNotification(payment.client_id, {
      title: 'Reembolso procesado',
      body: `Disputa resuelta a tu favor. Recibirás ARS ${payment.amount} en 5-10 días hábiles.`,
      data: { type: 'dispute_resolved', dispute_id: dispute.id.toString() },
    });

    await sendPushNotification(dispute.appointment.proposal.professional_id, {
      title: 'Disputa resuelta',
      body: 'El pago fue reembolsado al cliente. Contacta soporte si tienes dudas.',
      data: { type: 'dispute_resolved', dispute_id: dispute.id.toString() },
    });

    res.json({ success: true, refund });
  } catch (error) {
    console.error('Refund total error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/disputes/:id/refund-partial
router.post('/:id/refund-partial', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, admin_notes } = req.body;

    // Similar to refund-total but with custom amount
    // Implementation follows same pattern...
    res.json({ success: true, message: 'Partial refund endpoint - implement similar to refund-total' });
  } catch (error) {
    console.error('Refund partial error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
```

---

## 9. Database Indexes & Performance

### 9.1 Critical Indexes

**`backend/prisma/migrations/XXX_add_admin_indexes.sql`:**
```sql
-- Certifications: status + created_at for queue ordering
CREATE INDEX idx_certifications_pending_queue 
ON certifications(status, created_at ASC) 
WHERE status = 'pending';

-- Users: search with pg_trgm
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_users_search_name_email 
ON users USING gin (to_tsvector('spanish', full_name || ' ' || email));

-- Users: cursor pagination
CREATE INDEX idx_users_id_active 
ON users(id ASC) 
WHERE is_active = true;

-- Disputes: SLA monitoring
CREATE INDEX idx_disputes_open_created 
ON disputes(status, created_at ASC) 
WHERE status IN ('open', 'investigating');

-- Admin actions: log viewer filters
CREATE INDEX idx_admin_actions_admin_time 
ON admin_actions(admin_id, created_at DESC);

CREATE INDEX idx_admin_actions_type_time 
ON admin_actions(action_type, created_at DESC);

CREATE INDEX idx_admin_actions_entity 
ON admin_actions(entity_type, entity_id);

-- Content reports: queue ordering
CREATE INDEX idx_content_reports_pending 
ON content_reports(created_at ASC) 
WHERE status = 'pending';

-- Payments: dashboard analytics
CREATE INDEX idx_payments_status_created 
ON payments(status, created_at) 
WHERE status = 'completed';

-- Admin login attempts: security monitoring
CREATE INDEX idx_admin_login_attempts_ip 
ON admin_login_attempts(ip_address, created_at DESC);
```

### 9.2 Redis Caching Strategy

**`backend/src/lib/redis.ts`:**
```typescript
import { createClient } from 'redis';

export const redisClient = createClient({
  url: process.env.REDIS_URL,
});

redisClient.on('error', (err) => console.error('Redis Client Error', err));

(async () => {
  await redisClient.connect();
  console.log('✅ Redis connected');
})();

// Cache helper functions
export async function getCached<T>(key: string): Promise<T | null> {
  const cached = await redisClient.get(key);
  return cached ? JSON.parse(cached) : null;
}

export async function setCache(key: string, value: any, ttlSeconds: number = 300) {
  await redisClient.setEx(key, ttlSeconds, JSON.stringify(value));
}

export async function invalidateCache(pattern: string) {
  const keys = await redisClient.keys(pattern);
  if (keys.length > 0) {
    await redisClient.del(keys);
  }
}
```

---

## 10. Security Considerations

### 10.1 CSRF Protection

**`backend/src/middleware/csrf.ts`:**
```typescript
import csurf from 'csurf';

// CSRF protection for admin panel
export const csrfProtection = csurf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  },
});
```

### 10.2 Helmet.js Security Headers

**`backend/src/server.ts` (modification):**
```typescript
import helmet from 'helmet';

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https://res.cloudinary.com'],
        scriptSrc: ["'self'"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  })
);
```

### 10.3 File Upload Validation

**`backend/src/middleware/uploadValidation.ts`:**
```typescript
import { Request, Response, NextFunction } from 'express';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function validateFileUpload(req: Request, res: Response, next: NextFunction) {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  if (!ALLOWED_MIME_TYPES.includes(req.file.mimetype)) {
    return res.status(400).json({ error: 'Invalid file type. Only JPEG, PNG, PDF allowed.' });
  }

  if (req.file.size > MAX_FILE_SIZE) {
    return res.status(400).json({ error: 'File too large. Maximum size 10MB.' });
  }

  next();
}
```

---

## 11. Testing Strategy

### 11.1 Unit Tests (Jest)

**`backend/tests/unit/certificationParser.test.ts`:**
```typescript
import { parseCertificationFields } from '../../src/services/certificationParser';
import { prisma } from '../../src/lib/prisma';

jest.mock('../../src/lib/prisma');

describe('CertificationParser', () => {
  beforeEach(() => {
    (prisma.certificationPattern.findMany as jest.Mock).mockResolvedValue([
      {
        field_name: 'number',
        regex_pattern: 'MATR[ÍI]CULA.*?(\\d{4,8})',
      },
      {
        field_name: 'expiry_date',
        regex_pattern: 'VENCIMIENTO.*?(\\d{2}[-/]\\d{2}[-/]\\d{4})',
      },
    ]);
  });

  it('extracts gasista matricula number', async () => {
    const text = 'MATRÍCULA GASISTA N° 12345678 VENCIMIENTO 15/01/2029';
    const result = await parseCertificationFields(text, 'Matrícula Gasista');
    
    expect(result.number).toBe('12345678');
    expect(result.expiry_date).toBe('2029-01-15');
  });

  it('handles missing fields gracefully', async () => {
    const text = 'INVALID TEXT WITHOUT PATTERNS';
    const result = await parseCertificationFields(text, 'Matrícula Gasista');
    
    expect(result.number).toBeUndefined();
    expect(result.expiry_date).toBeUndefined();
  });
});
```

### 11.2 Integration Tests (Supertest)

**`backend/tests/integration/certifications.test.ts`:**
```typescript
import request from 'supertest';
import { app } from '../../src/server';
import { prisma } from '../../src/lib/prisma';

describe('POST /api/admin/certifications/:id/approve', () => {
  let adminToken: string;

  beforeAll(async () => {
    // Login as admin to get token
    const response = await request(app)
      .post('/api/admin/login')
      .send({ email: 'admin@test.com', password: 'TestPassword123!' });
    adminToken = response.body.token;
  });

  it('approves certification and updates professional', async () => {
    const res = await request(app)
      .post('/api/admin/certifications/1/approve')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ edited_fields: { number: '87654321' } });

    expect(res.status).toBe(200);

    const cert = await prisma.certification.findUnique({ where: { id: 1 } });
    expect(cert?.status).toBe('approved');
    expect(cert?.certification_number).toBe('87654321');

    const prof = await prisma.professional.findUnique({ where: { id: cert?.professional_id } });
    expect(prof?.is_verified).toBe(true);
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .post('/api/admin/certifications/1/approve')
      .send({ edited_fields: { number: '87654321' } });

    expect(res.status).toBe(401);
  });
});
```

### 11.3 E2E Tests (Playwright)

**`admin-panel/tests/e2e/certifications.spec.ts`:**
```typescript
import { test, expect } from '@playwright/test';

test('Admin approves certification', async ({ page }) => {
  // Login
  await page.goto('http://localhost:3000/admin/login');
  await page.fill('input[name=email]', 'admin@quickfixu.com');
  await page.fill('input[name=password]', 'SecurePass123!');
  await page.click('button[type=submit]');

  // Wait for redirect to dashboard
  await page.waitForURL('**/admin/dashboard');

  // Navigate to certifications
  await page.click('text=Certifications');
  await page.waitForURL('**/admin/certifications');

  // Click on first pending certification
  await page.click('table tbody tr:first-child');

  // Approve
  await page.click('button:has-text("Approve Certification")');

  // Verify success notification
  await expect(page.locator('.MuiSnackbar-root')).toContainText('Certification approved');
});
```

---

## 12. Deployment & Operations

### 12.1 Build Process

**`admin-panel/package.json` (scripts):**
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint src --ext ts,tsx --report-unused-disable-directives --max-warnings 0"
  }
}
```

**Build output:**
- Admin panel builds to `admin-panel/dist/`
- Backend serves static files from this directory

**`backend/src/server.ts` (serve admin panel):**
```typescript
import express from 'express';
import path from 'path';

// Serve admin panel static files
app.use('/admin', express.static(path.join(__dirname, '../../admin-panel/dist')));

// Admin panel SPA fallback
app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../admin-panel/dist/index.html'));
});
```

### 12.2 Environment Variables

**`.env.example`:**
```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/quickfixu

# Redis
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT
JWT_SECRET=your-jwt-secret-here
ADMIN_JWT_SECRET=your-admin-jwt-secret-here-different-from-user-jwt

# MercadoPago
MERCADOPAGO_ACCESS_TOKEN=your-mp-access-token
MERCADOPAGO_PUBLIC_KEY=your-mp-public-key

# Cloudinary
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Firebase
FIREBASE_SERVICE_ACCOUNT_KEY=path-to-service-account-json

# OCR
TESSERACT_LANG=spa
OCR_CONFIDENCE_THRESHOLD=60

# Admin
ADMIN_LOGIN_RATE_LIMIT=5
ADMIN_LOGIN_WINDOW_MINUTES=10

# Server
PORT=3000
NODE_ENV=production
```

### 12.3 Bull Dashboard (Monitoring)

**`backend/src/server.ts` (add Bull Board):**
```typescript
import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { ExpressAdapter } from '@bull-board/express';

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [new BullAdapter(certificationOCRQueue)],
  serverAdapter,
});

// Protected by requireAdmin middleware
app.use('/admin/queues', requireAdmin, serverAdapter.getRouter());
```

Access at: `http://localhost:3000/admin/queues`

---

## 13. API Endpoints Summary

### Admin Auth
- `POST /api/admin/login` - Admin authentication (rate limited 5/10min)
- `GET /api/admin/me` - Get current admin profile
- `POST /api/admin/admins/create` - Create new admin (super admin only)

### Analytics
- `GET /api/admin/analytics/dashboard` - KPIs, charts, conversion funnel, top professionals

### Users
- `GET /api/admin/users` - List users with filters (role, status, search, pagination)
- `GET /api/admin/users/:id` - User detail with transaction history & reviews
- `POST /api/admin/users/:id/block` - Block user with reason
- `POST /api/admin/users/:id/unblock` - Unblock user (super admin only)

### Certifications
- `GET /api/admin/certifications` - List certifications (filter by status, pagination)
- `GET /api/admin/certifications/:id` - Certification detail with OCR data
- `POST /api/admin/certifications/:id/approve` - Approve certification (editable fields)
- `POST /api/admin/certifications/:id/reject` - Reject certification with reason
- `POST /api/admin/certifications/:id/retry-ocr` - Manual OCR retry
- `GET /api/admin/certifications/stats` - Queue stats (avg approval time, approval rate, queue size)

### Disputes
- `GET /api/admin/disputes` - List disputes (filter by status, type, pagination)
- `GET /api/admin/disputes/:id` - Dispute detail with chat history & evidence
- `POST /api/admin/disputes/:id/refund-total` - Execute total refund via MP API
- `POST /api/admin/disputes/:id/refund-partial` - Execute partial refund
- `POST /api/admin/disputes/:id/payout-professional` - Payout professional
- `POST /api/admin/disputes/:id/close-no-action` - Close without action

### Payments
- `GET /api/admin/payments` - List payments (filter by status, method, date range, amount)
- `GET /api/admin/payments/:id` - Payment detail
- `POST /api/admin/payments/:id/force-payout` - Force payout (super admin only)
- `GET /api/admin/payments/stats` - Payment stats (total, GMV, commissions, refunds)
- `GET /api/admin/payments/export-afip-csv` - AFIP CSV export (super admin only)

### Content Moderation
- `POST /api/reports/create` - User reports content (mobile endpoint)
- `GET /api/admin/reports` - List content reports (filter by status, entity type)
- `GET /api/admin/reports/:id` - Report detail
- `POST /api/admin/reports/:id/delete-content` - Delete reported content (soft delete)
- `POST /api/admin/reports/:id/ban-user` - Ban user
- `POST /api/admin/reports/:id/dismiss` - Dismiss report

### Admin Actions
- `GET /api/admin/actions` - List admin actions with filters (admin, action type, date)
- `GET /api/admin/actions/export-csv` - Export logs to CSV

### Webhooks
- `GET /api/admin/webhooks/logs` - List webhook logs (last 100, filter by event type)
- `GET /api/admin/webhooks/logs/:id` - Webhook detail

---

## 14. Success Criteria

- ✅ Super admin can login at `/admin/login` and create other admins
- ✅ Dashboard loads in <2s, shows KPIs (GMV, users, professionals, transactions)
- ✅ Charts render correctly: registrations/day, transactions/day (last 30 days)
- ✅ Professional uploads certification → OCR job processes in <30s → OCR data appears in admin UI
- ✅ Admin approves certification → `professionals.is_verified = true`, FCM push sent
- ✅ Admin rejects certification with reason → FCM push sent with reason
- ✅ Admin sees dispute detail with chat history + payment details + evidence photos
- ✅ Admin clicks "Refund Total" → MP API refund executes, dispute status updated, users notified via FCM
- ✅ Admin blocks user → `users.is_active = false`, FCM push sent "Cuenta suspendida"
- ✅ Admin sees content report queue (reported posts/profiles), can delete content or block user
- ✅ All admin actions logged in `admin_actions` table with details (what, who, when, why)
- ✅ Admin can export logs as CSV for auditoría
- ✅ OCR confidence <60% → admin UI flags "Low Confidence" badge
- ✅ Admin can edit OCR fields manually before approving (always, regardless confidence)
- ✅ Button double-click doesn't cause double refund (idempotency enforced backend)
- ✅ Failed login rate limited (5 attempts/10min), Sentry alert if >50 failed logins/hour

---

## 15. Next Steps

1. ✅ **Design Complete** — This document
2. ⏭️ **Tasks Breakdown** — Create implementation task checklist (next phase)
3. ⏭️ **Sprint 1:** Admin auth + dashboard analytics + tabla admins (20h)
4. ⏭️ **Sprint 2:** OCR pipeline (Tesseract + Bull queue + preprocessing) (25h)
5. ⏭️ **Sprint 3:** Gestión certificaciones (lista pending + detail + approve/reject) (20h)
6. ⏭️ **Sprint 4:** Gestión disputas (lista + detail + refund/payout) (15h)
7. ⏭️ **Sprint 5:** Gestión usuarios + content reports (10h)
8. ⏭️ **Sprint 6:** Logs admin actions + webhook logs (10h)

**Total Estimated:** 100 hours (~2.5 weeks with 2 devs full-time)

---

**Document Version:** 1.0  
**Last Updated:** March 2026  
**Status:** ✅ Design Complete — Ready for implementation
