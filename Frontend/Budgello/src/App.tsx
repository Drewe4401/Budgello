import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import type { ReactNode, SetStateAction, Dispatch } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { FilePlus, Edit, Trash2, LogOut, Menu, X, Users, DollarSign, BarChart2, Home, Search, Tags } from 'lucide-react';
import './App.css'; // Assuming you have a CSS file for global styles

const API_BASE_URL = '/api';

// --- TYPE DEFINITIONS ---
interface User {
    id: number;
    username: string;
    role: 'admin' | 'user';
}

interface Category {
    id: number;
    user_id: number;
    name: string;
}

interface Transaction {
    id: number;
    user_id: number;
    description: string;
    amount: number;
    date: string; // ISO string
    category_id: number;
}

interface Budget {
    id: number;
    user_id: number;
    period: string; // ISO string
    frequency: 'weekly' | 'monthly' | 'yearly';
    amount: number;
}

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    isAdmin: boolean;
    login: (userData: { user_id: number; role: 'admin' | 'user'; username: string }) => void;
    logout: () => void;
    loading: boolean;
}

// --- AUTHENTICATION CONTEXT ---
const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        try {
            const storedUser = localStorage.getItem('budgelloUser');
            const expiry = localStorage.getItem('budgelloExpiry');

            if (storedUser && expiry && new Date().getTime() < Number(expiry)) {
                setUser(JSON.parse(storedUser));
            } else {
                localStorage.removeItem('budgelloUser');
                localStorage.removeItem('budgelloExpiry');
            }
        } catch (error) {
            console.error("Failed to parse user from localStorage", error);
        } finally {
            setLoading(false);
        }
    }, []);

    const login = (userData: { user_id: number; role: 'admin' | 'user'; username: string }) => {
        const thirtyDays = 30 * 24 * 60 * 60 * 1000;
        const expiry = new Date().getTime() + thirtyDays;
        
        const userToStore: User = { id: userData.user_id, role: userData.role, username: userData.username };
        localStorage.setItem('budgelloUser', JSON.stringify(userToStore));
        localStorage.setItem('budgelloExpiry', String(expiry));
        setUser(userToStore);
    };

    const logout = () => {
        localStorage.removeItem('budgelloUser');
        localStorage.removeItem('budgelloExpiry');
        setUser(null);
        window.location.hash = '/login';
        window.location.reload();
    };

    const authContextValue: AuthContextType = {
        user,
        isAuthenticated: !!user,
        isAdmin: user?.role === 'admin',
        login,
        logout,
        loading
    };

    return (
        <AuthContext.Provider value={authContextValue}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

// --- API SERVICE ---
const api = {
    async request<T>(endpoint: string, options: RequestInit = {}): Promise<T | null> {
        const url = `${API_BASE_URL}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers,
        };

        try {
            const response = await fetch(url, { ...options, headers });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'An unknown error occurred' }));
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }
            if (response.status === 204) {
                return null;
            }
            return response.json() as Promise<T>;
        } catch (error) {
            console.error(`API request to ${endpoint} failed:`, error);
            throw error;
        }
    },
    // User
    login: (username: string, password: string) => api.request<{ user_id: number; role: 'admin' | 'user', username: string }>('/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
    getUsers: () => api.request<User[]>('/users'),
    updateUser: (id: number, data: Partial<User>) => api.request<User>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteUser: (id: number) => api.request<null>(`/users/${id}`, { method: 'DELETE' }),
    registerUser: (username: string, password: string) => api.request<User>('/register', { method: 'POST', body: JSON.stringify({ username, password }) }),
    // Categories
    getCategories: (userId: number) => api.request<Category[]>(`/categories/${userId}`),
    createCategory: (data: Omit<Category, 'id'>) => api.request<Category>('/categories', { method: 'POST', body: JSON.stringify(data) }),
    updateCategory: (id: number, data: Partial<Category>) => api.request<Category>(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteCategory: (id: number) => api.request<null>(`/categories/${id}`, { method: 'DELETE' }),
    // Transactions
    getTransactions: (userId: number) => api.request<Transaction[]>(`/transactions/${userId}`),
    createTransaction: (data: Omit<Transaction, 'id'>) => api.request<Transaction>('/transactions', { method: 'POST', body: JSON.stringify(data) }),
    updateTransaction: (id: number, data: Partial<Transaction>) => api.request<Transaction>(`/transactions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteTransaction: (id: number) => api.request<null>(`/transactions/${id}`, { method: 'DELETE' }),
    // Budgets
    getBudgets: (userId: number) => api.request<Budget[]>(`/budgets/${userId}`),
    createBudget: (data: Omit<Budget, 'id'>) => api.request<Budget>('/budgets', { method: 'POST', body: JSON.stringify(data) }),
    updateBudget: (id: number, data: Partial<Budget>) => api.request<Budget>(`/budgets/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteBudget: (id: number) => api.request<null>(`/budgets/${id}`, { method: 'DELETE' }),
};

// --- REUSABLE COMPONENTS ---
interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: ReactNode;
}

const Modal = ({ isOpen, onClose, title, children }: ModalProps) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md m-4">
                <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
                    <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">{title}</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100">
                        <X size={24} />
                    </button>
                </div>
                <div className="p-6">
                    {children}
                </div>
            </div>
        </div>
    );
};

const Card = ({ children, className = '' }: { children: ReactNode, className?: string }) => (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 md:p-6 ${className}`}>
        {children}
    </div>
);

interface ButtonProps {
    children: ReactNode;
    onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
    className?: string;
    variant?: 'primary' | 'secondary' | 'danger';
    type?: 'button' | 'submit' | 'reset';
    disabled?: boolean;
}

const Button = ({ children, onClick, className = '', variant = 'primary', type = 'button', disabled = false }: ButtonProps) => {
    const baseClasses = 'px-4 py-2 rounded-md font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed';
    const variants = {
        primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
        secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 focus:ring-gray-500',
        danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
    };
    return (
        <button type={type} onClick={onClick} className={`${baseClasses} ${variants[variant]} ${className}`} disabled={disabled}>
            {children}
        </button>
    );
};

const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input
        {...props}
        className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:ring-blue-400 ${props.className || ''}`}
    />
);

const Select = ({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) => (
     <select
        {...props}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:ring-blue-400"
    >
        {children}
    </select>
);


// --- PAGES ---

const LoginPage = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { login } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        try {
            const data = await api.login(username, password);
            if (data) {
                login({...data, username});
                window.location.hash = '/dashboard';
            }
        } catch (err: any) {
            setError(err.message || 'Login failed. Please check your credentials.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
            <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md dark:bg-gray-800">
                <div className="text-center">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Welcome to Budgello</h1>
                    <p className="mt-2 text-gray-600 dark:text-gray-400">Sign in to your account</p>
                </div>
                <form className="space-y-6" onSubmit={handleSubmit}>
                    <div>
                        <label htmlFor="username" className="text-sm font-medium text-gray-700 dark:text-gray-300">Username</label>
                        <Input
                            id="username"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            placeholder="e.g., alice"
                            className="mt-1"
                        />
                    </div>
                    <div>
                        <label htmlFor="password-login" className="text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
                         <Input
                            id="password-login"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            placeholder="••••••••"
                            className="mt-1"
                        />
                    </div>
                    {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
                    <div>
                        <Button type="submit" className="w-full" disabled={isLoading}>
                            {isLoading ? 'Signing In...' : 'Sign In'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- DASHBOARD HELPER COMPONENTS & FUNCTIONS ---
const getStartOfWeek = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    return new Date(d.setDate(diff));
};

const getStartOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const getStartOfYear = (date: Date) => new Date(date.getFullYear(), 0, 1);

const SpendingSummaryCard = ({ title, spent, budget }: { title: string, spent: number, budget: number }) => {
    const remaining = budget - spent;
    const progress = budget > 0 ? (spent / budget) * 100 : 0;
    const isOverBudget = spent > budget;

    return (
        <Card>
            <h3 className="font-bold text-lg capitalize text-gray-800 dark:text-gray-100">{title}</h3>
            <div className="mt-4 space-y-2">
                <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-300">Spent</span>
                    <span className="font-semibold text-gray-800 dark:text-gray-100">${spent.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-300">Budget</span>
                    <span className="font-semibold text-gray-800 dark:text-gray-100">${budget.toFixed(2)}</span>
                </div>
                 <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 my-2">
                    <div 
                        className={`h-2.5 rounded-full ${isOverBudget ? 'bg-red-500' : 'bg-blue-600'}`} 
                        style={{ width: `${Math.min(progress, 100)}%` }}
                    ></div>
                </div>
                <div className="flex justify-between text-sm font-bold">
                    <span className={isOverBudget ? 'text-red-500' : 'text-gray-600 dark:text-gray-300'}>
                        {isOverBudget ? 'Over Budget' : 'Remaining'}
                    </span>
                    <span className={isOverBudget ? 'text-red-500' : 'text-green-600 dark:text-green-400'}>
                        ${Math.abs(remaining).toFixed(2)}
                    </span>
                </div>
            </div>
        </Card>
    );
};


const DashboardPage = () => {
    const { user } = useAuth();
    const [budgets, setBudgets] = useState<Budget[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [chartView, setChartView] = useState<'weekly' | 'monthly' | 'yearly'>('monthly');

    useEffect(() => {
        const fetchData = async () => {
            if (!user) return;
            try {
                setLoading(true);
                const [budgetsData, transactionsData, categoriesData] = await Promise.all([
                    api.getBudgets(user.id),
                    api.getTransactions(user.id),
                    api.getCategories(user.id)
                ]);
                setBudgets(budgetsData || []);
                setTransactions(transactionsData || []);
                setCategories(categoriesData || []);
            } catch (error) {
                console.error("Failed to fetch dashboard data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [user]);

    const now = new Date();
    const startOfWeek = getStartOfWeek(now);
    const startOfMonth = getStartOfMonth(now);
    const startOfYear = getStartOfYear(now);

    const weeklyBudget = budgets.find(b => b.frequency === 'weekly')?.amount || 0;
    const monthlyBudget = budgets.find(b => b.frequency === 'monthly')?.amount || 0;
    const yearlyBudget = budgets.find(b => b.frequency === 'yearly')?.amount || 0;

    const weeklySpending = transactions
        .filter(t => new Date(t.date) >= startOfWeek)
        .reduce((sum, t) => sum + t.amount, 0);
    const monthlySpending = transactions
        .filter(t => new Date(t.date) >= startOfMonth)
        .reduce((sum, t) => sum + t.amount, 0);
    const yearlySpending = transactions
        .filter(t => new Date(t.date) >= startOfYear)
        .reduce((sum, t) => sum + t.amount, 0);

    const categoryMap = React.useMemo(() => categories.reduce((acc, cat) => {
        acc[cat.id] = cat.name;
        return acc;
    }, {} as Record<number, string>), [categories]);

    const spendingByCategory = React.useMemo(() => transactions.reduce((acc, t) => {
        const categoryName = categoryMap[t.category_id] || 'Uncategorized';
        if (!acc[categoryName]) acc[categoryName] = 0;
        acc[categoryName] += t.amount;
        return acc;
    }, {} as Record<string, number>), [transactions, categoryMap]);

    const pieChartData = Object.entries(spendingByCategory).map(([name, value]) => ({ name, value }));
    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF', '#FF1955'];

    const lineChartData = React.useMemo(() => {
        let data: { name: string; spent: number }[] = [];
        const filteredTransactions = transactions.filter(t => {
            const tDate = new Date(t.date);
            if (chartView === 'weekly') return tDate >= startOfWeek;
            if (chartView === 'monthly') return tDate >= startOfMonth;
            if (chartView === 'yearly') return tDate >= startOfYear;
            return false;
        });

        if (chartView === 'weekly') {
            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            data = days.map(day => ({ name: day, spent: 0 }));
            filteredTransactions.forEach(t => {
                const dayIndex = new Date(t.date).getDay();
                data[dayIndex].spent += t.amount;
            });
        } else if (chartView === 'monthly') {
            const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
            data = Array.from({ length: daysInMonth }, (_, i) => ({ name: String(i + 1), spent: 0 }));
            filteredTransactions.forEach(t => {
                const dayOfMonth = new Date(t.date).getDate();
                data[dayOfMonth - 1].spent += t.amount;
            });
        } else if (chartView === 'yearly') {
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            data = months.map(month => ({ name: month, spent: 0 }));
            filteredTransactions.forEach(t => {
                const monthIndex = new Date(t.date).getMonth();
                data[monthIndex].spent += t.amount;
            });
        }
        return data;
    }, [transactions, chartView, now, startOfWeek, startOfMonth, startOfYear]);


    if (loading) return <div className="text-center p-8">Loading dashboard...</div>;

    return (
        <div className="p-4 md:p-6 lg:p-8 space-y-8">
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Dashboard</h1>
            
            <section>
                <h2 className="text-2xl font-semibold mb-4 text-gray-700 dark:text-gray-200">Spending Overview</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <SpendingSummaryCard title="This Week" spent={weeklySpending} budget={weeklyBudget} />
                    <SpendingSummaryCard title="This Month" spent={monthlySpending} budget={monthlyBudget} />
                    <SpendingSummaryCard title="This Year" spent={yearlySpending} budget={yearlyBudget} />
                </div>
            </section>
            
            <section>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-200">Spending Trend</h2>
                    <div className="flex gap-1 bg-gray-200 dark:bg-gray-700 p-1 rounded-md">
                        {(['weekly', 'monthly', 'yearly'] as const).map(view => (
                            <button 
                                key={view}
                                onClick={() => setChartView(view)}
                                className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${chartView === view ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600/50'}`}
                            >
                                {view.charAt(0).toUpperCase() + view.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>
                <Card>
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={lineChartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                            <Legend />
                            <Line type="monotone" dataKey="spent" stroke="#8884d8" strokeWidth={2} />
                        </LineChart>
                    </ResponsiveContainer>
                </Card>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                <section className="lg:col-span-3">
                    <h2 className="text-2xl font-semibold mb-4 text-gray-700 dark:text-gray-200">Recent Transactions</h2>
                    <Card>
                        <div className="space-y-4">
                            {transactions.slice(0, 5).map(t => (
                                <div key={t.id} className="flex justify-between items-center p-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700">
                                    <div>
                                        <p className="font-semibold text-gray-800 dark:text-gray-100">{t.description}</p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">{new Date(t.date).toLocaleDateString()}</p>
                                    </div>
                                    <p className="font-bold text-lg text-red-500">-${t.amount.toFixed(2)}</p>
                                </div>
                            ))}
                            {transactions.length === 0 && <p className="text-gray-500 dark:text-gray-400">No transactions yet.</p>}
                        </div>
                    </Card>
                </section>

                <section className="lg:col-span-2">
                    <h2 className="text-2xl font-semibold mb-4 text-gray-700 dark:text-gray-200">Spending by Category</h2>
                    <Card>
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie data={pieChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} fill="#8884d8" label>
                                    {pieChartData.map((_entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </Card>
                </section>
            </div>
        </div>
    );
};

const BudgetPage = () => {
    const { user } = useAuth();
    const [budgets, setBudgets] = useState<Budget[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchBudgets = useCallback(async () => {
        if (!user) return;
        try {
            setLoading(true);
            const data = await api.getBudgets(user.id);
            setBudgets(data || []);
        } catch (error) {
            console.error("Failed to fetch budgets:", error);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchBudgets();
    }, [fetchBudgets]);

    const handleOpenModal = (budget: Budget | null = null) => {
        setEditingBudget(budget);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingBudget(null);
    };

    const handleSave = async (formData: { frequency: Budget['frequency'], amount: string }) => {
        if (!user) return;
        const budgetData = {
            user_id: user.id,
            amount: parseFloat(formData.amount),
            frequency: formData.frequency,
            period: new Date().toISOString()
        };
        
        try {
            if (editingBudget) {
                await api.updateBudget(editingBudget.id, budgetData);
            } else {
                await api.createBudget(budgetData);
            }
            fetchBudgets();
            handleCloseModal();
        } catch (error: any) {
            alert(`Error saving budget: ${error.message}`);
        }
    };

    const handleDelete = async (id: number) => {
        if (window.confirm('Are you sure you want to delete this budget?')) {
            try {
                await api.deleteBudget(id);
                fetchBudgets();
            } catch (error: any) {
                alert(`Error deleting budget: ${error.message}`);
            }
        }
    };

    const existingFrequencies = budgets.map(b => b.frequency);

    return (
        <div className="p-4 md:p-6 lg:p-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Budgets</h1>
                <Button onClick={() => handleOpenModal()} disabled={existingFrequencies.length >= 3}>
                    <FilePlus size={20} /> New Budget
                </Button>
            </div>

            {loading ? <p>Loading budgets...</p> : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {budgets.map(budget => (
                    <Card key={budget.id} className="flex flex-col justify-between">
                        <div>
                            <h2 className="text-xl font-semibold capitalize text-blue-600 dark:text-blue-400">{budget.frequency}</h2>
                            <p className="text-4xl font-bold my-4 text-gray-800 dark:text-gray-100">${budget.amount.toFixed(2)}</p>
                        </div>
                        <div className="flex gap-2 mt-4">
                            <Button onClick={() => handleOpenModal(budget)} variant="secondary" className="w-full">
                                <Edit size={16} /> Edit
                            </Button>
                            <Button onClick={() => handleDelete(budget.id)} variant="danger" className="w-full">
                                <Trash2 size={16} /> Delete
                            </Button>
                        </div>
                    </Card>
                ))}
                {budgets.length === 0 && <p className="text-gray-500 dark:text-gray-400">You haven't set any budgets yet.</p>}
            </div>
            )}

            <BudgetForm
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onSave={handleSave}
                budget={editingBudget}
                existingFrequencies={existingFrequencies}
            />
        </div>
    );
};

interface BudgetFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: { frequency: Budget['frequency'], amount: string }) => void;
    budget: Budget | null;
    existingFrequencies: string[];
}

const BudgetForm = ({ isOpen, onClose, onSave, budget, existingFrequencies }: BudgetFormProps) => {
    const [frequency, setFrequency] = useState<Budget['frequency'] | ''>('');
    const [amount, setAmount] = useState('');

    // ✅ FIXED: Added 'isOpen' to the dependency array
    useEffect(() => {
        if (isOpen && budget) {
            setFrequency(budget.frequency);
            setAmount(String(budget.amount));
        } else {
            setFrequency('');
            setAmount('');
        }
    }, [budget, isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (frequency) {
            onSave({ frequency, amount });
        }
    };

    const availableFrequencies = (['weekly', 'monthly', 'yearly'] as const).filter(
        f => !existingFrequencies.includes(f) || (budget && f === budget.frequency)
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={budget ? 'Edit Budget' : 'Add Budget'}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Frequency</label>
                    <Select value={frequency} onChange={e => setFrequency(e.target.value as Budget['frequency'])} required disabled={!!budget}>
                        <option value="" disabled>Select frequency</option>
                        {budget && <option value={budget.frequency}>{budget.frequency}</option>}
                        {availableFrequencies.map(f => <option key={f} value={f}>{f}</option>)}
                    </Select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Amount</label>
                    <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} required placeholder="e.g., 500.00" step="0.01"/>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                    <Button onClick={onClose} variant="secondary" type="button">Cancel</Button>
                    <Button type="submit">Save Budget</Button>
                </div>
            </form>
        </Modal>
    );
};

const CategoriesPage = () => {
    const { user } = useAuth();
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);

    const fetchCategories = useCallback(async () => {
        if (!user) return;
        try {
            setLoading(true);
            const data = await api.getCategories(user.id);
            setCategories(data || []);
        } catch (error) {
            console.error("Failed to fetch categories:", error);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchCategories();
    }, [fetchCategories]);

    const handleOpenModal = (category: Category | null = null) => {
        setEditingCategory(category);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingCategory(null);
    };

    const handleSave = async (formData: { name: string }) => {
        if (!user) return;
        try {
            if (editingCategory) {
                await api.updateCategory(editingCategory.id, { name: formData.name });
            } else {
                await api.createCategory({ name: formData.name, user_id: user.id });
            }
            fetchCategories();
            handleCloseModal();
        } catch (error: any) {
            alert(`Error saving category: ${error.message}`);
        }
    };

    const handleDelete = async (id: number) => {
        if (window.confirm('Are you sure you want to delete this category? This may affect existing transactions.')) {
            try {
                await api.deleteCategory(id);
                fetchCategories();
            } catch (error: any) {
                alert(`Error deleting category: ${error.message}`);
            }
        }
    };

    return (
        <div className="p-4 md:p-6 lg:p-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Categories</h1>
                <Button onClick={() => handleOpenModal()} className="w-full sm:w-auto">
                    <FilePlus size={20} /> New Category
                </Button>
            </div>

            {loading ? (
                <div className="text-center py-8">
                    <p className="text-gray-500 dark:text-gray-400">Loading categories...</p>
                </div>
            ) : categories.length === 0 ? (
                 <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow-md">
                    <Tags className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No categories</h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Get started by creating a new category.</p>
               </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {categories.map(cat => (
                        <Card key={cat.id} className="p-4 flex justify-between items-center">
                            <p className="font-semibold text-gray-800 dark:text-gray-100">{cat.name}</p>
                            <div className="flex items-center gap-1">
                                <button 
                                    onClick={() => handleOpenModal(cat)} 
                                    className="p-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                    aria-label={`Edit ${cat.name}`}
                                >
                                    <Edit size={18} />
                                </button>
                                <button 
                                    onClick={() => handleDelete(cat.id)} 
                                    className="p-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                    aria-label={`Delete ${cat.name}`}
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            <CategoryForm
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onSave={handleSave}
                category={editingCategory}
            />
        </div>
    );
};

interface CategoryFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: { name: string }) => void;
    category: Category | null;
}

const CategoryForm = ({ isOpen, onClose, onSave, category }: CategoryFormProps) => {
    const [name, setName] = useState('');

    // This component was already correct, no changes needed here.
    useEffect(() => {
        if (category) {
            setName(category.name);
        } else {
            setName('');
        }
    }, [category, isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ name });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={category ? 'Edit Category' : 'Add Category'}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category Name</label>
                    <Input 
                        type="text" 
                        value={name} 
                        onChange={e => setName(e.target.value)} 
                        required 
                        placeholder="e.g., Groceries"
                    />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                    <Button onClick={onClose} variant="secondary" type="button">Cancel</Button>
                    <Button type="submit">Save Category</Button>
                </div>
            </form>
        </Modal>
    );
};


const TransactionsPage = () => {
    const { user } = useAuth();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchAllData = useCallback(async () => {
        if (!user) return;
        try {
            setLoading(true);
            const [transData, catData] = await Promise.all([
                api.getTransactions(user.id),
                api.getCategories(user.id)
            ]);
            setTransactions(transData || []);
            setCategories(catData || []);
        } catch (error) {
            console.error("Failed to fetch data:", error);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    const handleOpenModal = (transaction: Transaction | null = null) => {
        setEditingTransaction(transaction);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingTransaction(null);
    };

    const handleSave = async (formData: Omit<Transaction, 'id' | 'user_id'>) => {
        if (!user) return;
        const transactionData = {
            ...formData,
            user_id: user.id,
            amount: parseFloat(String(formData.amount)),
            category_id: parseInt(String(formData.category_id), 10),
            date: new Date(formData.date).toISOString()
        };
        try {
            if (editingTransaction) {
                await api.updateTransaction(editingTransaction.id, transactionData);
            } else {
                await api.createTransaction(transactionData);
            }
            fetchAllData();
            handleCloseModal();
        } catch (error: any) {
            alert(`Error saving transaction: ${error.message}`);
        }
    };

    const handleDelete = async (id: number) => {
        if (window.confirm('Are you sure you want to delete this transaction?')) {
            try {
                await api.deleteTransaction(id);
                fetchAllData();
            } catch (error: any) {
                alert(`Error deleting transaction: ${error.message}`);
            }
        }
    };
    
    const categoryMap = categories.reduce((acc, cat) => {
        acc[cat.id] = cat.name;
        return acc;
    }, {} as Record<number, string>);

    const filteredTransactions = transactions.filter(t => 
        t.description.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-4 md:p-6 lg:p-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Transactions</h1>
                <div className="flex gap-4 w-full md:w-auto">
                    <div className="relative flex-grow">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <Search className="h-5 w-5 text-gray-400" aria-hidden="true" />
                        </div>
                        <Input
                            type="text"
                            placeholder="Search transactions..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10"
                        />
                    </div>
                    <Button onClick={() => handleOpenModal()}>
                        <FilePlus size={20} /> New
                    </Button>
                </div>
            </div>

            {/* Mobile View: List of Cards */}
            <div className="space-y-4 md:hidden">
                {loading ? <p>Loading transactions...</p> : filteredTransactions.map(t => (
                    <Card key={t.id}>
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="font-semibold text-gray-800 dark:text-gray-100">{t.description}</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{categoryMap[t.category_id] || 'Uncategorized'}</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{new Date(t.date).toLocaleDateString()}</p>
                            </div>
                            <p className="font-bold text-lg text-red-500">-${t.amount.toFixed(2)}</p>
                        </div>
                        <div className="flex gap-2 mt-4 border-t pt-3 dark:border-gray-700">
                            <Button onClick={() => handleOpenModal(t)} variant="secondary" className="w-full text-xs">
                                <Edit size={16} /> Edit
                            </Button>
                            <Button onClick={() => handleDelete(t.id)} variant="danger" className="w-full text-xs">
                                <Trash2 size={16} /> Delete
                            </Button>
                        </div>
                    </Card>
                ))}
            </div>

            {/* Desktop View: Table */}
            <Card className="hidden md:block overflow-x-auto">
                {loading ? <p>Loading transactions...</p> : (
                <table className="w-full text-left">
                    <thead className="border-b dark:border-gray-700">
                        <tr>
                            <th className="p-4 text-sm font-semibold text-gray-600 dark:text-gray-300">Description</th>
                            <th className="p-4 text-sm font-semibold text-gray-600 dark:text-gray-300">Amount</th>
                            <th className="p-4 text-sm font-semibold text-gray-600 dark:text-gray-300">Category</th>
                            <th className="p-4 text-sm font-semibold text-gray-600 dark:text-gray-300">Date</th>
                            <th className="p-4 text-sm font-semibold text-gray-600 dark:text-gray-300">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredTransactions.map(t => (
                            <tr key={t.id} className="border-b dark:border-gray-700 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                <td className="p-4 text-gray-800 dark:text-gray-100">{t.description}</td>
                                <td className="p-4 text-red-600 dark:text-red-400 font-semibold">${t.amount.toFixed(2)}</td>
                                <td className="p-4 text-gray-600 dark:text-gray-300">{categoryMap[t.category_id] || 'Uncategorized'}</td>
                                <td className="p-4 text-gray-600 dark:text-gray-300">{new Date(t.date).toLocaleDateString()}</td>
                                <td className="p-4">
                                    <div className="flex gap-2">
                                        <button onClick={() => handleOpenModal(t)} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"><Edit size={18} /></button>
                                        <button onClick={() => handleDelete(t.id)} className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"><Trash2 size={18} /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                )}
                {!loading && filteredTransactions.length === 0 && <p className="p-4 text-center text-gray-500 dark:text-gray-400">No transactions found.</p>}
            </Card>

            <TransactionForm
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onSave={handleSave}
                transaction={editingTransaction}
                categories={categories}
            />
        </div>
    );
};

interface TransactionFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: Omit<Transaction, 'id' | 'user_id'>) => void;
    transaction: Transaction | null;
    categories: Category[];
}

const TransactionForm = ({ isOpen, onClose, onSave, transaction, categories }: TransactionFormProps) => {
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState('');
    const [categoryId, setCategoryId] = useState('');

    // ✅ FIXED: Added 'isOpen' to the dependency array
    useEffect(() => {
        if (isOpen && transaction) {
            setDescription(transaction.description);
            setAmount(String(transaction.amount));
            setDate(new Date(transaction.date).toISOString().split('T')[0]);
            setCategoryId(String(transaction.category_id));
        } else {
            setDescription('');
            setAmount('');
            setDate(new Date().toISOString().split('T')[0]);
            setCategoryId('');
        }
    }, [transaction, isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ description, amount: Number(amount), date, category_id: Number(categoryId) });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={transaction ? 'Edit Transaction' : 'Add Transaction'}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
                    <Input type="text" value={description} onChange={e => setDescription(e.target.value)} required />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Amount</label>
                    <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} required step="0.01" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
                    <Select value={categoryId} onChange={e => setCategoryId(e.target.value)} required>
                        <option value="" disabled>Select a category</option>
                        {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                    </Select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Date</label>
                    <Input type="date" value={date} onChange={e => setDate(e.target.value)} required />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                    <Button onClick={onClose} variant="secondary" type="button">Cancel</Button>
                    <Button type="submit">Save Transaction</Button>
                </div>
            </form>
        </Modal>
    );
};

const UsersPage = () => {
    const { isAdmin } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);

    const fetchUsers = useCallback(async () => {
        try {
            setLoading(true);
            const data = await api.getUsers();
            setUsers(data || []);
        } catch (error) {
            console.error("Failed to fetch users:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isAdmin) {
            fetchUsers();
        }
    }, [isAdmin, fetchUsers]);

    const handleOpenModal = (user: User | null = null) => {
        setEditingUser(user);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingUser(null);
    };

    const handleSave = async (formData: {username: string, password?: string, role: 'admin' | 'user'}) => {
        try {
            if (editingUser) {
                await api.updateUser(editingUser.id, { username: formData.username, role: formData.role });
            } else if (formData.password) {
                await api.registerUser(formData.username, formData.password);
            }
            fetchUsers();
            handleCloseModal();
        } catch (error: any) {
            alert(`Error saving user: ${error.message}`);
        }
    };

    const handleDelete = async (id: number) => {
        if (window.confirm('Are you sure you want to delete this user? This is irreversible.')) {
            try {
                await api.deleteUser(id);
                fetchUsers();
            } catch (error: any) {
                alert(`Error deleting user: ${error.message}`);
            }
        }
    };

    if (!isAdmin) {
        return <div className="p-8 text-center"><h1 className="text-2xl text-red-600">Access Denied</h1><p>You must be an administrator to view this page.</p></div>;
    }

    return (
        <div className="p-4 md:p-6 lg:p-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">User Management</h1>
                <Button onClick={() => handleOpenModal()}><FilePlus size={20} /> Add User</Button>
            </div>

            {/* Mobile View */}
            <div className="space-y-4 md:hidden">
                {loading ? <p>Loading users...</p> : users.map(u => (
                    <Card key={u.id}>
                        <div className="flex justify-between items-start">
                             <div>
                                <p className="font-semibold text-gray-800 dark:text-gray-100">{u.username}</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">ID: {u.id}</p>
                            </div>
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${u.role === 'admin' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200'}`}>{u.role}</span>
                        </div>
                        <div className="flex gap-2 mt-4 border-t pt-3 dark:border-gray-700">
                            <Button onClick={() => handleOpenModal(u)} variant="secondary" className="w-full text-xs"><Edit size={16} /> Edit</Button>
                            <Button onClick={() => handleDelete(u.id)} variant="danger" className="w-full text-xs"><Trash2 size={16} /> Delete</Button>
                        </div>
                    </Card>
                ))}
            </div>

            {/* Desktop View */}
            <Card className="hidden md:block overflow-x-auto">
                {loading ? <p>Loading users...</p> : (
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b dark:border-gray-700">
                            <th className="p-4 text-sm font-semibold text-gray-600 dark:text-gray-300">ID</th>
                            <th className="p-4 text-sm font-semibold text-gray-600 dark:text-gray-300">Username</th>
                            <th className="p-4 text-sm font-semibold text-gray-600 dark:text-gray-300">Role</th>
                            <th className="p-4 text-sm font-semibold text-gray-600 dark:text-gray-300">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(u => (
                            <tr key={u.id} className="border-b dark:border-gray-700 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                <td className="p-4 text-gray-800 dark:text-gray-100">{u.id}</td>
                                <td className="p-4 text-gray-800 dark:text-gray-100">{u.username}</td>
                                <td className="p-4 text-gray-600 dark:text-gray-300"><span className={`px-2 py-1 text-xs font-semibold rounded-full ${u.role === 'admin' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200'}`}>{u.role}</span></td>
                                <td className="p-4">
                                    <div className="flex gap-2">
                                        <button onClick={() => handleOpenModal(u)} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"><Edit size={18} /></button>
                                        <button onClick={() => handleDelete(u.id)} className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"><Trash2 size={18} /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                )}
            </Card>
            <UserForm
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onSave={handleSave}
                user={editingUser}
            />
        </div>
    );
};

interface UserFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: {username: string, password?: string, role: 'admin' | 'user'}) => void;
    user: User | null;
}

const UserForm = ({ isOpen, onClose, onSave, user }: UserFormProps) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<'user' | 'admin'>('user');

    // ✅ FIXED: Added 'isOpen' to the dependency array
    useEffect(() => {
        if (isOpen && user) {
            setUsername(user.username);
            setRole(user.role);
            setPassword('');
        } else {
            setUsername('');
            setRole('user');
            setPassword('');
        }
    }, [user, isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!user && !password) {
            alert("Password is required for new users.");
            return;
        }
        onSave({ username, password, role });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={user ? 'Edit User' : 'Add User'}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Username</label>
                    <Input type="text" value={username} onChange={e => setUsername(e.target.value)} required />
                </div>
                {!user && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
                        <Input id="password-create" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
                    </div>
                )}
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Role</label>
                    <Select value={role} onChange={e => setRole(e.target.value as 'user' | 'admin')} required>
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                    </Select>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                    <Button onClick={onClose} variant="secondary" type="button">Cancel</Button>
                    <Button type="submit">Save User</Button>
                </div>
            </form>
        </Modal>
    );
};


// --- LAYOUT COMPONENTS ---

interface SidebarProps {
    isSidebarOpen: boolean;
    setSidebarOpen: Dispatch<SetStateAction<boolean>>;
}

const Sidebar = ({ isSidebarOpen, setSidebarOpen }: SidebarProps) => {
    const { logout, isAdmin, user } = useAuth();
    const [activePage, setActivePage] = useState(window.location.hash || '#/dashboard');

    useEffect(() => {
        const handleHashChange = () => {
            setActivePage(window.location.hash);
        };
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    const NavLink = ({ href, icon, children }: { href: string, icon: ReactNode, children: ReactNode }) => (
        <a 
            href={href} 
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center p-3 my-1 rounded-lg transition-colors duration-200 ${activePage === href ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
        >
            {icon}
            <span className="ml-4 font-medium">{children}</span>
        </a>
    );

    return (
        <>
            <div className={`fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden ${isSidebarOpen ? 'block' : 'hidden'}`} onClick={() => setSidebarOpen(false)}></div>
            
            <aside className={`fixed top-0 left-0 h-full w-64 bg-white dark:bg-gray-800 shadow-lg z-40 transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:shadow-none lg:border-r dark:lg:border-gray-700`}>
                <div className="flex flex-col h-full">
                    <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
                        <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-400">Budgello</h1>
                        <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-gray-500 hover:text-gray-800">
                            <X size={24} />
                        </button>
                    </div>
                    
                    <nav className="flex-grow p-4">
                        <NavLink href="#/dashboard" icon={<Home size={20} />}>Dashboard</NavLink>
                        <NavLink href="#/budgets" icon={<DollarSign size={20} />}>Budgets</NavLink>
                        <NavLink href="#/transactions" icon={<BarChart2 size={20} />}>Transactions</NavLink>
                        <NavLink href="#/categories" icon={<Tags size={20} />}>Categories</NavLink>
                        {isAdmin && <NavLink href="#/users" icon={<Users size={20} />}>Users</NavLink>}
                    </nav>

                    <div className="p-4 border-t dark:border-gray-700">
                         <div className="mb-4">
                            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{user?.username}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{user?.role}</p>
                        </div>
                        <Button onClick={logout} variant="secondary" className="w-full">
                            <LogOut size={16} /> Logout
                        </Button>
                    </div>
                </div>
            </aside>
        </>
    );
};

const MainContent = () => {
    const { isAuthenticated, loading } = useAuth();
    const [page, setPage] = useState(window.location.hash.substring(1) || '/login');

    useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash.substring(1);
            if (isAuthenticated) {
                 setPage(hash || '/dashboard');
            } else {
                 setPage('/login');
            }
        };
        
        if (loading) return; 
        
        if (!isAuthenticated) {
            if (window.location.hash !== '#/login') {
                window.location.hash = '/login';
            }
        } else if (window.location.hash === '#/login' || window.location.hash === '') {
            window.location.hash = '/dashboard';
        }
        
        handleHashChange();

        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, [isAuthenticated, loading]);

    if (loading) {
        return <div className="flex items-center justify-center h-screen"><p>Loading application...</p></div>;
    }

    if (!isAuthenticated) {
        return <LoginPage />;
    }

    const renderPage = () => {
        switch (page) {
            case '/dashboard':
                return <DashboardPage />;
            case '/budgets':
                return <BudgetPage />;
            case '/transactions':
                return <TransactionsPage />;
            case '/categories':
                return <CategoriesPage />;
            case '/users':
                return <UsersPage />;
            default:
                // Redirect to dashboard if hash is invalid
                window.location.hash = '/dashboard';
                return <DashboardPage />;
        }
    };
    
    return renderPage();
};

// --- APP ---
export default function App() {
    return (
        <AuthProvider>
            <div className="bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 min-h-screen">
                <AppContent />
            </div>
        </AuthProvider>
    );
}

const AppContent = () => {
    const { isAuthenticated, loading } = useAuth();
    const [isSidebarOpen, setSidebarOpen] = useState(false);

    if (loading) {
      return <div className="flex items-center justify-center h-screen">Loading...</div>
    }

    if (!isAuthenticated) {
        return <MainContent />;
    }

    return (
        <div className="flex">
            <Sidebar isSidebarOpen={isSidebarOpen} setSidebarOpen={setSidebarOpen} />
            <main className="flex-1 lg:ml-64 transition-all duration-300">
                <header className="sticky top-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm lg:hidden p-4 border-b dark:border-gray-700 flex items-center z-20">
                    <button onClick={() => setSidebarOpen(true)} className="text-gray-600 dark:text-gray-300">
                        <Menu size={24} />
                    </button>
                    <h1 className="ml-4 font-semibold text-lg">Budgello</h1>
                </header>
                <MainContent />
            </main>
        </div>
    );
}
