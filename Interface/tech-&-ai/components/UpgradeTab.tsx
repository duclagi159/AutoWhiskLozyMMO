import React, { useState, useEffect } from 'react';
import { RefreshCw, Download, Package, ShieldCheck, Terminal, Cloud, Info, CheckCircle, Loader2, AlertCircle } from 'lucide-react';

declare global {
    interface Window {
        chrome: any;
    }
}

const UpgradeTab: React.FC = () => {
    const [status, setStatus] = useState<'idle' | 'checking' | 'uptodate' | 'available' | 'downloading' | 'installing' | 'restarting' | 'error'>('idle');
    const [currentVersion, setCurrentVersion] = useState("1.0.2");
    const [remoteVersion, setRemoteVersion] = useState("");
    const [releaseNotes, setReleaseNotes] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [downloadMessage, setDownloadMessage] = useState("");

    useEffect(() => {
        const handleMessage = (event: any) => {
            if (!event.data) return;
            const { type, data } = event.data;

            if (type === 'update_status') {
                console.log("Update status received:", data);
                if (data.status === 'checking') setStatus('checking');
                if (data.status === 'uptodate') {
                    setStatus('uptodate');
                    if (data.version) setCurrentVersion(data.version);
                }
                if (data.status === 'available') {
                    setStatus('available');
                    setRemoteVersion(data.version);
                    setReleaseNotes(data.releaseNotes);
                }
                if (data.status === 'downloading') {
                    setStatus('downloading');
                    if (data.progress !== undefined) setDownloadProgress(data.progress);
                    if (data.message) setDownloadMessage(data.message);
                }
                if (data.status === 'installing') { setStatus('installing'); setDownloadProgress(100); }
                if (data.status === 'restarting') setStatus('restarting');
                if (data.status === 'error') {
                    setStatus('error');
                    setErrorMessage(data.message);
                }
            }
        };

        if (window.chrome?.webview) {
            window.chrome.webview.addEventListener('message', handleMessage);
        }

        return () => {
            if (window.chrome?.webview) {
                window.chrome.webview.removeEventListener('message', handleMessage);
            }
        };
    }, []);

    const handleCheck = () => {
        setStatus('checking');
        if (window.chrome?.webview) {
            window.chrome.webview.postMessage({ type: 'check_update' });
        } else {
            // Mock fallback
            setTimeout(() => {
                setStatus('available');
                setRemoteVersion("1.1.0");
                setReleaseNotes("Mock update: New features added.");
            }, 1500);
        }
    };

    const handleUpdate = () => {
        setStatus('downloading');
        setDownloadProgress(0);
        setDownloadMessage('Starting download...');
        if (window.chrome?.webview) {
            window.chrome.webview.postMessage({ type: 'start_update' });
        } else {
            // Mock fallback
            setTimeout(() => setStatus('installing'), 2000);
            setTimeout(() => setStatus('restarting'), 4000);
        }
    }

    const isBusy = status === 'checking' || status === 'downloading' || status === 'installing' || status === 'restarting';

    return (
        <div className="h-full flex flex-col items-center justify-center p-6 md:p-12 relative overflow-hidden">
            {/* Background decorative elements */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/5 blur-[120px] rounded-full pointer-events-none" />

            <div className="relative z-10 w-full max-w-2xl">

                {/* Header Section */}
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center p-4 bg-zinc-900/50 border border-zinc-800 rounded-full mb-6 shadow-xl backdrop-blur-sm relative group">
                        <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur-lg opacity-0 group-hover:opacity-100 transition-opacity" />
                        <Cloud className="w-8 h-8 text-indigo-400 relative z-10" />
                    </div>
                    <h2 className="text-3xl font-bold text-zinc-100 mb-2 tracking-tight">System Update</h2>
                    <p className="text-zinc-500 text-sm">Quản lý phiên bản và cập nhật phần mềm</p>
                </div>

                {/* Status Card */}
                <div className="bg-[#18181b] border border-zinc-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">

                    <div className="flex flex-col items-center text-center">

                        {/* Status Icon */}
                        <div className="mb-6">
                            {status === 'checking' || status === 'downloading' || status === 'installing' ? (
                                <Loader2 className="w-16 h-16 text-indigo-500 animate-spin" />
                            ) : status === 'uptodate' ? (
                                <ShieldCheck className="w-16 h-16 text-emerald-500 drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]" />
                            ) : status === 'available' ? (
                                <Download className="w-16 h-16 text-indigo-500 animate-bounce" />
                            ) : status === 'error' ? (
                                <AlertCircle className="w-16 h-16 text-red-500" />
                            ) : (
                                <Package className="w-16 h-16 text-zinc-600" />
                            )}
                        </div>

                        {/* Status Text */}
                        <h3 className="text-xl font-semibold text-zinc-100 mb-2">
                            {status === 'checking' ? 'Đang kiểm tra phiên bản...' :
                                status === 'uptodate' ? 'Phần mềm đã được cập nhật' :
                                    status === 'available' ? `Đã tìm thấy phiên bản mới: v${remoteVersion}` :
                                        status === 'downloading' ? `Đang tải: ${downloadProgress}%` :
                                            status === 'installing' ? 'Đang cài đặt...' :
                                                status === 'restarting' ? 'Đang khởi động lại...' :
                                                    status === 'error' ? 'Có lỗi xảy ra' :
                                                        `Phiên bản hiện tại: v${currentVersion}`}
                        </h3>

                        {/* Download Progress Bar */}
                        {status === 'downloading' && (
                            <div className="w-full max-w-md mb-4">
                                <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden mb-2">
                                    <div
                                        className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400 rounded-full transition-all duration-300 ease-out"
                                        style={{ width: `${downloadProgress}%` }}
                                    />
                                </div>
                                <p className="text-xs text-zinc-500 text-center font-mono">{downloadMessage}</p>
                            </div>
                        )}

                        <p className="text-zinc-500 mb-8 max-w-md text-sm leading-relaxed">
                            {status === 'checking' ? 'Hệ thống đang kết nối đến máy chủ để tìm kiếm các bản vá và tính năng mới nhất.' :
                                status === 'uptodate' ? 'Bạn đang sử dụng phiên bản mới nhất. Hãy quay lại sau để kiểm tra các bản cập nhật trong tương lai.' :
                                    status === 'available' ? 'Một phiên bản mới đã sẵn sàng. Vui lòng cập nhật để trải nghiệm các tính năng tốt nhất.' :
                                        status === 'downloading' ? 'Vui lòng không tắt ứng dụng trong quá trình tải xuống.' :
                                            status === 'error' ? errorMessage :
                                                'Nhấn nút bên dưới để kiểm tra xem có bản cập nhật nào cho Tech & AI không.'}
                        </p>

                        {/* Action Button */}
                        <div className="w-full max-w-xs">
                            {status === 'available' ? (
                                <button
                                    onClick={handleUpdate}
                                    className="w-full py-3.5 px-6 rounded-xl font-semibold text-sm transition-all duration-300 flex items-center justify-center bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-500/20 hover:scale-[1.02] active:scale-[0.98]"
                                >
                                    <Download className="w-4 h-4 mr-2" /> Cập nhật ngay
                                </button>
                            ) : (
                                <button
                                    onClick={handleCheck}
                                    disabled={isBusy || status === 'uptodate'}
                                    className={`
                                    w-full py-3.5 px-6 rounded-xl font-semibold text-sm transition-all duration-300 flex items-center justify-center
                                    ${isBusy
                                            ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700'
                                            : status === 'uptodate'
                                                ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 cursor-default'
                                                : status === 'error'
                                                    ? 'bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20'
                                                    : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                                        }
                                `}
                                >
                                    {isBusy ? (
                                        <>Waiting...</>
                                    ) : status === 'uptodate' ? (
                                        <><CheckCircle className="w-4 h-4 mr-2" /> Đã cập nhật v{currentVersion}</>
                                    ) : status === 'error' ? (
                                        <>Thử lại</>
                                    ) : (
                                        <>Kiểm tra cập nhật</>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Changelog / Info Section */}
                    <div className="mt-8 pt-8 border-t border-zinc-800/50">
                        <div className="flex items-center mb-4">
                            <Terminal className="w-4 h-4 text-zinc-500 mr-2" />
                            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                                {status === 'available' ? `Thông tin phiên bản v${remoteVersion}` : `Thông tin phiên bản v${currentVersion}`}
                            </span>
                        </div>

                        <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800/50">
                            {status === 'available' && releaseNotes ? (
                                <pre className="text-sm text-zinc-400 whitespace-pre-wrap font-sans">{releaseNotes}</pre>
                            ) : (
                                <ul className="space-y-2.5">
                                    {[
                                        'Cải thiện tốc độ xử lý Tách Prompt AI (nhanh hơn 30%)',
                                        'Thêm giao diện Dark Mode chuẩn Zinc UI',
                                        'Tối ưu hóa bộ nhớ khi xử lý file lớn',
                                        'Sửa lỗi hiển thị trên màn hình nhỏ'
                                    ].map((item, index) => (
                                        <li key={index} className="flex items-start text-sm text-zinc-400">
                                            <span className="w-1 h-1 rounded-full bg-zinc-600 mt-2 mr-3 shrink-0" />
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            )}

                        </div>

                        <div className="mt-4 flex items-center justify-center gap-2 text-[10px] text-zinc-600">
                            <Info className="w-3 h-3" />
                            <span>Build: 2024.05.20_RC1</span>
                            <span>•</span>
                            <span>Channel: Stable</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UpgradeTab;