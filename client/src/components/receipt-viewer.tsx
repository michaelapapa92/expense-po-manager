import { useState, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, RotateCw, Maximize2 } from "lucide-react";

interface ReceiptViewerProps {
  src: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReceiptViewer({ src, open, onOpenChange }: ReceiptViewerProps) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const posStart = useRef({ x: 0, y: 0 });

  const resetView = useCallback(() => {
    setScale(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  }, []);

  const zoomIn = () => setScale((s) => Math.min(s + 0.5, 5));
  const zoomOut = () => setScale((s) => Math.max(s - 0.5, 0.5));
  const rotate = () => setRotation((r) => (r + 90) % 360);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      setScale((s) => Math.min(s + 0.25, 5));
    } else {
      setScale((s) => Math.max(s - 0.25, 0.5));
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (scale <= 1) return;
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    posStart.current = { ...position };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    setPosition({
      x: posStart.current.x + (e.clientX - dragStart.current.x),
      y: posStart.current.y + (e.clientY - dragStart.current.y),
    });
  };

  const handlePointerUp = () => setDragging(false);

  const handleOpenChange = (val: boolean) => {
    if (!val) resetView();
    onOpenChange(val);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[90vw] max-h-[90vh] w-auto p-0 overflow-hidden bg-slate-900 border-slate-700 [&>button]:text-white [&>button]:hover:text-white [&>button]:hover:bg-slate-700">
        <DialogTitle className="sr-only">Receipt Image</DialogTitle>
        <div className="flex items-center gap-1 px-3 py-2 bg-slate-800 border-b border-slate-700">
          <Button variant="ghost" size="sm" onClick={zoomIn} className="text-white hover:bg-slate-700 h-8 px-2" data-testid="button-zoom-in">
            <ZoomIn className="w-4 h-4 mr-1" /> Zoom In
          </Button>
          <Button variant="ghost" size="sm" onClick={zoomOut} className="text-white hover:bg-slate-700 h-8 px-2" data-testid="button-zoom-out">
            <ZoomOut className="w-4 h-4 mr-1" /> Zoom Out
          </Button>
          <Button variant="ghost" size="sm" onClick={rotate} className="text-white hover:bg-slate-700 h-8 px-2" data-testid="button-rotate">
            <RotateCw className="w-4 h-4 mr-1" /> Rotate
          </Button>
          <Button variant="ghost" size="sm" onClick={resetView} className="text-white hover:bg-slate-700 h-8 px-2" data-testid="button-reset-view">
            <Maximize2 className="w-4 h-4 mr-1" /> Reset
          </Button>
          <span className="text-xs text-slate-400 ml-auto">{Math.round(scale * 100)}%</span>
        </div>
        <div
          className="flex items-center justify-center overflow-hidden"
          style={{ width: "85vw", height: "80vh", cursor: scale > 1 ? (dragging ? "grabbing" : "grab") : "zoom-in" }}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onClick={() => { if (scale <= 1) zoomIn(); }}
        >
          <img
            src={src}
            alt="Receipt"
            draggable={false}
            className="select-none"
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
              transition: dragging ? "none" : "transform 0.2s ease",
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ReceiptThumbnail({ src }: { src: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div
        className="p-2 bg-slate-100 rounded-lg border cursor-pointer group relative"
        onClick={() => setOpen(true)}
        data-testid="receipt-thumbnail"
      >
        <img src={src} alt="Receipt" className="max-h-[500px] w-full mx-auto rounded object-contain" />
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors rounded-lg">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded-full p-2 shadow">
            <ZoomIn className="w-5 h-5 text-slate-700" />
          </div>
        </div>
      </div>
      <ReceiptViewer src={src} open={open} onOpenChange={setOpen} />
    </>
  );
}
