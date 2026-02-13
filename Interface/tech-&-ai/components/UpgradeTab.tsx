import { useState, useEffect } from 'react';
import { RefreshCw, Download, Package, ShieldCheck, Terminal, Cloud, Info, CheckCircle, Loader2, AlertCircle } from 'lucide-react';

const REPO = 'duclagi159/AutoWhiskLozyMMO';
const CURRENT_VERSION = '6.0.0';

interface ReleaseInfo {
    tag_name: string;
    name: string;
    body: string;
    published_at: string;
    assets: { name: string; browser_download_url: string; size: number }[];
}

const UpgradeTab: React.FC = () => {
    const [status, setStatus] = useState<'idle' | 'checking' | 'uptodate' | 'available' | 'downloading' | 'done' | 'error'>('idle');
    const [remoteVersion, setRemoteVersion] = useState('');
    const [releaseNotes, setReleaseNotes] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [downloadUrl, setDownloadUrl] = useState('');

    useEffect(() => {
        handleCheck();
    }, []);

    const handleCheck = async () => {
        setStatus('checking');
        setErrorMessage('');
        try {
            const resp = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`);
            if (!resp.ok) throw new Error(`GitHub API error: ${resp.status}`);
            const release: ReleaseInfo = await resp.json();
            const remote = release.tag_name.replace(/^v/, '');

            if (compareVersions(remote, CURRENT_VERSION) > 0) {
                setRemoteVersion(remote);
                setReleaseNotes(release.body || 'Không có thông tin cập nhật.');
                const exeAsset = release.assets.find(a => a.name.endsWith('.exe'));
                if (exeAsset) setDownloadUrl(exeAsset.browser_download_url);
                setStatus('available');
            } else {
                setStatus('uptodate');
            }
        } catch (err: any) {
            setStatus('error');
            setErrorMessage(err.message || 'Không thể kết nối đến máy chủ.');
        }
    };

    const handleUpdate = async () => {
        if (!downloadUrl) {
            setStatus('error');
            setErrorMessage('Không tìm thấy file cập nhật.');
            return;
        }
        setStatus('downloading');
        setDownloadProgress(0);

        try {
            const resp = await fetch(downloadUrl);
            if (!resp.ok) throw new Error('Download failed');

            const total = parseInt(resp.headers.get('content-length') || '0');
            const reader = resp.body?.getReader();
            if (!reader) throw new Error('Stream not supported');

            const chunks: Uint8Array[] = [];
            let received = 0;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
                received += value.length;
                if (total > 0) setDownloadProgress(Math.round((received / total) * 100));
            }

            const blob = new Blob(chunks);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'autowhisk.exe';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            setDownloadProgress(100);
            setStatus('done');
        } catch (err: any) {
            setStatus('error');
            setErrorMessage(err.message || 'Lỗi khi tải file.');
        }
    };

    const isBusy = status === 'checking' || status === 'downloading';

    return (
        <div className="h-full flex flex-col items-center justify-center p-6 md:p-12 relative overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/5 blur-[120px] rounded-full pointer-events-none" />

            <div className="relative z-10 w-full max-w-2xl">
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center p-4 bg-zinc-900/50 border border-zinc-800 rounded-full mb-6 shadow-xl backdrop-blur-sm relative group">
                        <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur-lg opacity-0 group-hover:opacity-100 transition-opacity" />
                        <Cloud className="w-8 h-8 text-indigo-400 relative z-10" />
                    </div>
                    <h2 className="text-3xl font-bold text-zinc-100 mb-2 tracking-tight">System Update</h2>
                    <p className="text-zinc-500 text-sm">Quản lý phiên bản và cập nhật phần mềm</p>
                </div>

                <div className="bg-[#18181b] border border-zinc-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
                    <div className="flex flex-col items-center text-center">
                        <div className="mb-6">
                            {status === 'checking' || status === 'downloading' ? (
                                <Loader2 className="w-16 h-16 text-indigo-500 animate-spin" />
                            ) : status === 'uptodate' || status === 'done' ? (
                                <ShieldCheck className="w-16 h-16 text-emerald-500 drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]" />
                            ) : status === 'available' ? (
                                <Download className="w-16 h-16 text-indigo-500 animate-bounce" />
                            ) : status === 'error' ? (
                                <AlertCircle className="w-16 h-16 text-red-500" />
                            ) : (
                                <Package className="w-16 h-16 text-zinc-600" />
                            )}
                        </div>

                        <h3 className="text-xl font-semibold text-zinc-100 mb-2">
                            {status === 'checking' ? 'Đang kiểm tra phiên bản...' :
                                status === 'uptodate' ? 'Phần mềm đã được cập nhật' :
                                    status === 'available' ? `Phiên bản mới: v${remoteVersion}` :
                                        status === 'downloading' ? `Đang tải: ${downloadProgress}%` :
                                            status === 'done' ? 'Tải xong! Hãy thay thế file exe' :
                                                status === 'error' ? 'Có lỗi xảy ra' :
                                                    `Phiên bản hiện tại: v${CURRENT_VERSION}`}
                        </h3>

                        {status === 'downloading' && (
                            <div className="w-full max-w-md mb-4">
                                <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden mb-2">
                                    <div
                                        className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400 rounded-full transition-all duration-300 ease-out"
                                        style={{ width: `${downloadProgress}%` }}
                                    />
                                </div>
                                <p className="text-xs text-zinc-500 text-center font-mono">Đang tải autowhisk.exe...</p>
                            </div>
                        )}

                        <p className="text-zinc-500 mb-8 max-w-md text-sm leading-relaxed">
                            {status === 'checking' ? 'Đang kết nối GitHub để kiểm tra bản cập nhật mới nhất.' :
                                status === 'uptodate' ? 'Bạn đang sử dụng phiên bản mới nhất.' :
                                    status === 'available' ? 'Một phiên bản mới đã sẵn sàng. Tải về và thay thế file autowhisk.exe.' :
                                        status === 'downloading' ? 'Vui lòng không tắt ứng dụng trong quá trình tải.' :
                                            status === 'done' ? 'File đã được tải về. Tắt tool → thay thế autowhisk.exe → mở lại.' :
                                                status === 'error' ? errorMessage :
                                                    'Nhấn nút bên dưới để kiểm tra bản cập nhật.'}
                        </p>

                        <div className="w-full max-w-xs">
                            {status === 'available' ? (
                                <button
                                    onClick={handleUpdate}
                                    className="w-full py-3.5 px-6 rounded-xl font-semibold text-sm transition-all duration-300 flex items-center justify-center bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-500/20 hover:scale-[1.02] active:scale-[0.98]"
                                >
                                    <Download className="w-4 h-4 mr-2" /> Tải cập nhật
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
                                                : status === 'done'
                                                    ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 cursor-default'
                                                    : status === 'error'
                                                        ? 'bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20 cursor-pointer'
                                                        : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600 cursor-pointer'
                                        }
                  `}
                                >
                                    {isBusy ? (
                                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Đang xử lý...</>
                                    ) : status === 'uptodate' ? (
                                        <><CheckCircle className="w-4 h-4 mr-2" /> Đã cập nhật v{CURRENT_VERSION}</>
                                    ) : status === 'done' ? (
                                        <><CheckCircle className="w-4 h-4 mr-2" /> Tải xong!</>
                                    ) : status === 'error' ? (
                                        <><RefreshCw className="w-4 h-4 mr-2" /> Thử lại</>
                                    ) : (
                                        <><RefreshCw className="w-4 h-4 mr-2" /> Kiểm tra cập nhật</>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="mt-8 pt-8 border-t border-zinc-800/50">
                        <div className="flex items-center mb-4">
                            <Terminal className="w-4 h-4 text-zinc-500 mr-2" />
                            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                                {status === 'available' ? `Có gì mới trong v${remoteVersion}` : `Phiên bản v${CURRENT_VERSION}`}
                            </span>
                        </div>

                        <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800/50">
                            {status === 'available' && releaseNotes ? (
                                <pre className="text-sm text-zinc-400 whitespace-pre-wrap font-sans">{releaseNotes}</pre>
                            ) : (
                                <ul className="space-y-2.5">
                                    {[
                                        'Reuse workflow - không tạo project mới mỗi lần chạy',
                                        'Extension chỉ cần cookie, backend tự lấy token',
                                        'Thread tối đa 1-2-3 cho mỗi account',
                                        'Fix ratio global cho task mới',
                                        'Quản lý project link với nút xóa',
                                        'Cookie expiry cập nhật real-time',
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
                            <span>v{CURRENT_VERSION}</span>
                            <span>•</span>
                            <span>Channel: Stable</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

function compareVersions(a: string, b: string): number {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const va = pa[i] || 0;
        const vb = pb[i] || 0;
        if (va > vb) return 1;
        if (va < vb) return -1;
    }
    return 0;
}

export default UpgradeTab;