interface VideoItem {
  url: string;
  taskOrder: number;
  index: number;
}

interface Props {
  videos: VideoItem[];
  onPreviewVideo?: (url: string, taskOrder: number) => void;
}

export function VideoGallery({ videos, onPreviewVideo }: Props) {
  if (videos.length === 0) return null;

  return (
    <div className="bg-[#12121a] rounded-xl border border-gray-800 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-300">🎬 Video đã tạo ({videos.length})</span>
      </div>
      <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
        {videos.map((v, i) => (
          <div
            key={i}
            onClick={() => onPreviewVideo?.(v.url, v.taskOrder)}
            className="aspect-video bg-gray-900 rounded-lg overflow-hidden cursor-pointer border-2 border-transparent hover:border-cyan-500 transition-all group relative"
          >
            <video src={v.url} className="w-full h-full object-cover" muted preload="metadata" />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <span className="text-2xl">▶️</span>
            </div>
            <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/70 rounded text-[10px] text-gray-300">
              #{v.taskOrder}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
