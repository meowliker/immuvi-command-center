import { useEffect } from 'react';

let locks = 0;
let previousOverflow = '';

export function useModalScrollLock() {
  useEffect(() => {
    if (locks++ === 0) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    // A task can disappear during a nested editor; release locks in any order.
    return () => {
      if (--locks === 0) document.body.style.overflow = previousOverflow;
    };
  }, []);
}
