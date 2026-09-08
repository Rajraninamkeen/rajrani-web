import { useRef, useState } from 'react';
import { fallbackImage } from '../format.jsx';

// Product thumbnail/detail image. Tries the real remote URL first; if it fails to
// load (broken URL, or offline preview iframe) it swaps to an inline SVG tile so
// the layout never shows a broken-image icon.
export default function ProductImage({ src, name, slug, className = '', alt = '' }) {
  const [failed, setFailed] = useState(false);
  const fallback = fallbackImage(name, slug || name);
  if (!src || failed) {
    return <div className={'img-tile ' + className}><img src={fallback} alt={alt || name} loading="lazy" /></div>;
  }
  return (
    <div className={'img-tile ' + className}>
      <img
        src={src}
        alt={alt || name}
        loading="lazy"
        onError={() => setFailed(true)}
      />
    </div>
  );
}
