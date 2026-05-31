import { photoBg, type Photo } from "@/lib/data";

type Props = {
  photo: Photo;
  onClick?: () => void;
  onExpand?: () => void;
};

export function PhotoThumb({ photo, onClick, onExpand }: Props) {
  return (
    <div className="thumb" onClick={onClick}>
      {photo.previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo.previewUrl}
          alt=""
          loading="lazy"
          className="thumb__img"
          style={{ objectFit: "contain", display: "block", width: "100%", height: "100%" }}
        />
      ) : (
        <div className="thumb__img" style={{ background: photoBg(photo) }} />
      )}
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
