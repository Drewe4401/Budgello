import { useState, useEffect, createContext, useContext, useMemo } from 'react';
import type { ReactNode, FC, FormEvent, MouseEvent } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import './App.css';

// --- CONFIGURATION ---
const API_URL = 'http://localhost:8080';

// --- TYPE DEFINITIONS ---
interface User {
  id: number;
  username: string;
  role: 'admin' | 'user';
  password?: string;
}

interface Category {
    id: number;
    name: string;
}

interface Transaction {
    id: number;
    user_id: number;
    description: string;
    amount: number;
    date: string;
    category_id: number;
}

interface Budget {
    id: number;
    user_id: number;
    category_id: number;
    amount: number;
    month: number;
    year: number;
}

interface AuthContextType {
  user: User | null;
  login: (userData: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

interface DataContextType {
    users: User[];
    categories: Category[];
    transactions: Transaction[];
    budgets: Budget[];
    isLoading: boolean;
    fetchData: () => Promise<void>;
    addTransaction: (newTransaction: Omit<Transaction, 'id' | 'date' | 'user_id'>) => Promise<void>;
    createBudget: (newBudget: Omit<Budget, 'id' | 'user_id'>) => Promise<void>;
    addUser: (newUser: Omit<User, 'id' | 'role'>) => Promise<void>;
    getCategoryName: (id: number) => string;
}

type Page = 'dashboard' | 'users' | 'sharing';


// --- ICONS ---
const LogoutIcon: FC<{ className?: string }> = ({ className = "w-6 h-6" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
);
const PlusIcon: FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" />
    </svg>
);
const CloseIcon: FC<{ className?: string }> = ({ className = "w-6 h-6" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
);
const MenuIcon: FC<{ className?: string }> = ({ className = "w-6 h-6" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
);
const DashboardIcon: FC<{ className?: string }> = ({ className = "w-6 h-6" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
);
const UsersIcon: FC<{ className?: string }> = ({ className = "w-6 h-6" }) => (
     <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M15 21a6 6 0 00-9-5.197m0 0A4 4 0 019 10.146M12 4.354a4 4 0 010 5.292" />
    </svg>
);
const ShareIcon: FC<{ className?: string }> = ({ className = "w-6 h-6" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12s-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6.002l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.368a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
    </svg>
);


// --- CONTEXT PROVIDERS ---
const AuthContext = createContext<AuthContextType | null>(null);
const DataContext = createContext<DataContextType | null>(null);

const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth must be used within an AuthProvider");
    return context;
};

const useData = () => {
    const context = useContext(DataContext);
    if (!context) throw new Error("useData must be used within a DataProvider");
    return context;
};

const AuthProvider: FC<{children: ReactNode}> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        setIsLoading(false);
    }, []);

    const login = (userData: User) => setUser(userData);
    const logout = () => setUser(null);

    const value = { user, login, logout, isAuthenticated: !!user };

    return <AuthContext.Provider value={value}>{isLoading ? <LoadingScreen /> : children}</AuthContext.Provider>;
};

const DataProvider: FC<{children: ReactNode}> = ({ children }) => {
    const { user } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [budgets, setBudgets] = useState<Budget[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const getCategoryName = (id: number) => categories.find(c => c.id === id)?.name || 'Unknown';

    const fetchData = async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const endpoints: { [key: string]: string } = {
                transactions: `${API_URL}/transactions/${user.id}`,
                budgets: `${API_URL}/budgets/${user.id}`,
            };
            if (user.role === 'admin') {
                endpoints.users = `${API_URL}/admin/users`;
            }

            const [transRes, budgRes, usersRes] = await Promise.all([
                fetch(endpoints.transactions),
                fetch(endpoints.budgets),
                user.role === 'admin' ? fetch(endpoints.users) : Promise.resolve(null),
            ]);

            const transData = await transRes.json();
            const budgData = await budgRes.json();
            
            setTransactions(Array.isArray(transData) ? transData : []);
            setBudgets(Array.isArray(budgData) ? budgData : []);
            
            if (usersRes) {
                const usersData = await usersRes.json();
                setUsers(Array.isArray(usersData) ? usersData : []);
            }
            
            setCategories([
                {id: 1, name: 'Groceries'}, {id: 2, name: 'Transport'}, {id: 3, name: 'Entertainment'},
                {id: 4, name: 'Utilities'}, {id: 5, name: 'Rent'}, {id: 6, name: 'Health'}
            ]);

        } catch (error) {
            console.error("Failed to fetch data:", error);
            alert("Could not fetch data from the server.");
        } finally {
            setIsLoading(false);
        }
    };
    
    const addTransaction = async (newTransaction: Omit<Transaction, 'id' | 'date' | 'user_id'>) => {
        if(!user) return;
        await fetch(`${API_URL}/transactions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...newTransaction, user_id: user.id, amount: +newTransaction.amount }),
        });
        await fetchData();
    };

    const addUser = async (newUser: Omit<User, 'id' | 'role'>) => {
         await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newUser),
        });
        await fetchData();
    }

    useEffect(() => {
        if (user) {
            fetchData();
        }
    }, [user]);

    const value = { users, categories, transactions, budgets, isLoading, fetchData, addTransaction, createBudget: async () => {}, addUser, getCategoryName };

    return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

// --- REUSABLE UI COMPONENTS ---
const AppButton: FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className = '', ...props }) => (
    <button className={`flex items-center justify-center px-4 py-2 font-semibold rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-opacity-75 transition duration-200 ease-in-out disabled:cursor-not-allowed bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-400 disabled:bg-blue-300 ${className}`} {...props} />
);
const AppInput: FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ className = '', ...props }) => (
    <input className={`w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${className}`} {...props} />
);
const AppSelect: FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({ className = '', children, ...props }) => (
    <select className={`w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${className}`} {...props}>{children}</select>
);
const Card: FC<{ children: ReactNode, className?: string }> = ({ children, className = '' }) => (
    <div className={`bg-white rounded-xl shadow-lg p-4 sm:p-6 ${className}`}>{children}</div>
);
const Modal: FC<{ isOpen: boolean; onClose: () => void; title: string; children: ReactNode }> = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b border-gray-200">
                    <h3 className="text-xl font-semibold text-gray-800">{title}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><CloseIcon /></button>
                </div>
                <div className="p-6">{children}</div>
            </div>
        </div>
    );
};
const LoadingScreen: FC = () => (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center">
            <svg className="mx-auto h-12 w-12 text-blue-600 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <h2 className="mt-4 text-xl font-semibold text-gray-700">Loading Budgello...</h2>
        </div>
    </div>
);


// --- FORMS ---
const AddTransactionForm: FC<{ onClose: () => void }> = ({ onClose }) => {
    const { addTransaction, categories } = useData();
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [categoryId, setCategoryId] = useState(categories[0]?.id.toString() || '');

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        await addTransaction({ description, amount: parseFloat(amount), category_id: parseInt(categoryId) });
        onClose();
    };
    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
                <AppInput id="description" type="text" value={description} onChange={(e) => setDescription(e.target.value)} required />
            </div>
            <div>
                <label htmlFor="amount" className="block text-sm font-medium text-gray-700">Amount</label>
                <AppInput id="amount" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </div>
            <div>
                <label htmlFor="category" className="block text-sm font-medium text-gray-700">Category</label>
                <AppSelect id="category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </AppSelect>
            </div>
            <AppButton type="submit" className="w-full">Add Transaction</AppButton>
        </form>
    );
};
const AddUserForm: FC<{ onClose: () => void }> = ({ onClose }) => {
    const { addUser } = useData();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        await addUser({ username, password });
        onClose();
    };
    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label htmlFor="new-username" className="block text-sm font-medium text-gray-700">Username</label>
                <AppInput id="new-username" value={username} onChange={e => setUsername(e.target.value)} required />
            </div>
            <div>
                <label htmlFor="new-password">Password</label>
                <AppInput id="new-password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <AppButton type="submit" className="w-full">Create User</AppButton>
        </form>
    );
}

// --- LOGIN SCREEN ---
const LoginScreen: FC = () => {
    const [username, setUsername] = useState('alice');
    const [password, setPassword] = useState('password123');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { login } = useAuth();
    const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        try {
            const response = await fetch(`${API_URL}/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
            const data = await response.json();
            if (response.ok && data.user_id && data.role) {
                login({ id: data.user_id, role: data.role, username: username });
            } else {
                setError(data.message || 'Invalid credentials.');
            }
        } catch (e) {
            setError('Could not connect to the server.');
        } finally {
            setIsLoading(false);
        }
    };
    return (
        <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
            <div className="w-full max-w-sm">
                <div className="text-center mb-8">
                    <h1 className="text-5xl font-bold text-blue-600">Budgello</h1>
                    <p className="mt-2 text-lg text-gray-500">Your finances, simplified.</p>
                </div>
                <Card className="shadow-2xl">
                    <form onSubmit={handleLogin} className="space-y-6">
                        {error && <p className="text-center text-red-600 bg-red-100 p-3 rounded-lg text-sm">{error}</p>}
                        <div>
                            <label htmlFor="username" className="sr-only">Username</label>
                            <AppInput id="username" type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
                        </div>
                        <div>
                            <label htmlFor="password-input" className="sr-only">Password</label>
                            <AppInput id="password-input" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
                        </div>
                        <AppButton type="submit" className="w-full py-3" disabled={isLoading}>{isLoading ? 'Logging in...' : 'Login'}</AppButton>
                    </form>
                </Card>
            </div>
        </div>
    );
};

// --- DASHBOARD PAGES ---
const DashboardPage: FC = () => {
    const { transactions, budgets, isLoading, getCategoryName } = useData();
    const [isModalOpen, setIsModalOpen] = useState(false);

    const spendingByCategory = useMemo(() => {
        const dataMap = new Map<string, number>();
        transactions.forEach(t => {
            const categoryName = getCategoryName(t.category_id);
            dataMap.set(categoryName, (dataMap.get(categoryName) || 0) + t.amount);
        });
        return Array.from(dataMap, ([name, value]) => ({ name, value }));
    }, [transactions, getCategoryName]);
    
    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

    if (isLoading) return <p>Loading dashboard...</p>;

    return (
        <div className="space-y-6">
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add New Transaction">
                <AddTransactionForm onClose={() => setIsModalOpen(false)} />
            </Modal>
            
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold text-gray-800">Dashboard</h2>
                <AppButton onClick={() => setIsModalOpen(true)}><PlusIcon className="mr-2" /> Add Transaction</AppButton>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card><h3 className="text-gray-500">Total Spent</h3><p className="text-2xl font-bold">${transactions.reduce((s, t) => s + t.amount, 0).toFixed(2)}</p></Card>
                <Card><h3 className="text-gray-500">Transactions</h3><p className="text-2xl font-bold">{transactions.length}</p></Card>
                <Card><h3 className="text-gray-500">Budgets Set</h3><p className="text-2xl font-bold">{budgets.length}</p></Card>
                <Card><h3 className="text-gray-500">Budget Total</h3><p className="text-2xl font-bold">${budgets.reduce((s, b) => s + b.amount, 0).toFixed(2)}</p></Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <h3 className="text-xl font-semibold text-gray-800 mb-4">Spending by Category</h3>
                     <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie data={spendingByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} fill="#8884d8" label>
                                {spendingByCategory.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                            </Pie>
                            <Tooltip />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </Card>
                 <Card>
                    <h3 className="text-xl font-semibold text-gray-800 mb-4">Recent Transactions</h3>
                    <ul className="space-y-3 max-h-80 overflow-y-auto">
                        {transactions.map(t => (
                            <li key={t.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-md">
                                <div><span className="font-medium text-gray-800">{t.description}</span><span className="block text-sm text-gray-500">{getCategoryName(t.category_id)}</span></div>
                                <span className="text-red-600 font-semibold">-${t.amount.toFixed(2)}</span>
                            </li>
                        ))}
                    </ul>
                </Card>
            </div>
        </div>
    );
};

const UserManagementPage: FC = () => {
    const { users, isLoading } = useData();
    const [isModalOpen, setIsModalOpen] = useState(false);
    if (isLoading) return <p>Loading users...</p>;

    return (
        <div className="space-y-6">
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create New User"><AddUserForm onClose={() => setIsModalOpen(false)} /></Modal>
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold text-gray-800">User Management</h2>
                <AppButton onClick={() => setIsModalOpen(true)}><PlusIcon className="mr-2" /> Add User</AppButton>
            </div>
            <Card>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {users.map(u => (
                                <tr key={u.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{u.id}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{u.username}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${u.role === 'admin' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>{u.role}</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};

const SharedBudgetsPage: FC = () => (
    <div>
        <h2 className="text-3xl font-bold text-gray-800">Shared Budgets</h2>
        <Card className="mt-6">
            <p className="text-gray-500">This feature is under construction. Admins will be able to manage budget sharing permissions here.</p>
        </Card>
    </div>
);

// --- LAYOUT & NAVIGATION ---
const AppLayout: FC = () => {
    const { user, logout } = useAuth();
    const [page, setPage] = useState<Page>('dashboard');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const NavLink: FC<{children: ReactNode, icon: ReactNode, target: Page}> = ({ children, icon, target }) => (
        <a href="#" onClick={(e) => { e.preventDefault(); setPage(target); setIsSidebarOpen(false); }} className={`flex items-center px-4 py-3 text-lg rounded-lg transition-colors ${page === target ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-200'}`}>
            <span className="mr-3">{icon}</span>{children}
        </a>
    );

    const renderPage = () => {
        switch (page) {
            case 'users': return <UserManagementPage />;
            case 'sharing': return <SharedBudgetsPage />;
            case 'dashboard':
            default: return <DashboardPage />;
        }
    };

    return (
        <div className="flex h-screen bg-gray-100">
            {/* Sidebar */}
            <aside className={`fixed inset-y-0 left-0 bg-white shadow-lg w-64 p-4 transform transition-transform z-30 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0`}>
                <h1 className="text-3xl font-bold text-blue-600 px-4 mb-8">Budgello</h1>
                <nav className="space-y-2">
                    <NavLink icon={<DashboardIcon />} target="dashboard">Dashboard</NavLink>
                    {user?.role === 'admin' && (
                        <>
                            <NavLink icon={<UsersIcon />} target="users">Users</NavLink>
                            <NavLink icon={<ShareIcon />} target="sharing">Sharing</NavLink>
                        </>
                    )}
                </nav>
                <div className="absolute bottom-4 left-4 right-4">
                     <div className="p-3 rounded-lg bg-gray-100 text-center text-sm">
                        <p className="font-semibold text-gray-800">{user?.username}</p>
                        <p className="text-gray-500">{user?.role}</p>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                <header className="bg-white shadow-sm lg:hidden">
                    <div className="flex items-center justify-between p-4">
                        <button onClick={() => setIsSidebarOpen(true)} className="text-gray-500 focus:outline-none"><MenuIcon /></button>
                        <h1 className="text-xl font-bold text-blue-600">Budgello</h1>
                        <button onClick={logout} className="text-gray-500 focus:outline-none"><LogoutIcon /></button>
                    </div>
                </header>
                <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-4 sm:p-6">
                    {renderPage()}
                </main>
            </div>
        </div>
    );
};

// --- APP ENTRY POINT ---
function App() {
    return (
        <AuthProvider>
            <DataProvider>
                <MainNavigator />
            </DataProvider>
        </AuthProvider>
    );
}

const MainNavigator: FC = () => {
    const { isAuthenticated } = useAuth();
    return isAuthenticated ? <AppLayout /> : <LoginScreen />;
};

export default App;
