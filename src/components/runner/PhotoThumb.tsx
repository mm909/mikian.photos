import { photoBg, type Photo } from "@/lib/data";

type Props = {
  photo: Photo;
  onClick?: () => void;
  onExpand?: () => void;
};

export function PhotoThumb({ photo, onClick, onExpand }: Props) {
  return (
    <div className="thumb" onClick={onClick}>
      <div className="thumb__img" style={{ background: photoBg(photo) }} />
      <div className="thumb__wm">MIKIAN.PHOTOS</div>
      <div
        className="thumb__expand"
        onClick={(e) => {
          e.stopPropagation();
          onExpand?.();
        }}
      >
        ⛶
      </div>
    </div>
  );
}
