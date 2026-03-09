import { useState, useRef, useEffect } from 'react';

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  eager?: boolean;
  sizes?: string;
}

export default function OptimizedImage({ src, alt, className = '', eager = false, sizes }: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(eager);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (eager || !imgRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, [eager]);

  const getSrcSet = (baseSrc: string) => {
    if (!baseSrc.includes('pexels.com')) return undefined;
    const baseUrl = baseSrc.split('?')[0];
    return `${baseUrl}?auto=compress&cs=tinysrgb&w=400 400w, ${baseUrl}?auto=compress&cs=tinysrgb&w=800 800w, ${baseUrl}?auto=compress&cs=tinysrgb&w=1200 1200w, ${baseUrl}?auto=compress&cs=tinysrgb&w=1920 1920w`;
  };

  return (
    <img
      ref={imgRef}
      src={isInView ? src : undefined}
      srcSet={isInView ? getSrcSet(src) : undefined}
      sizes={sizes || '(max-width: 640px) 100vw, (max-width: 1024px) 80vw, 1200px'}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      onLoad={() => setIsLoaded(true)}
      className={`${className} transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
    />
  );
}
