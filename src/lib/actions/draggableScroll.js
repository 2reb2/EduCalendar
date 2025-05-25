export function draggableScroll(node) {
    let isDown = false;
    let startX;
    let scrollLeft;
  
    const onMouseDown = (e) => {
      isDown = true;
      node.classList.add('cursor-grabbing');
      startX = e.pageX - node.offsetLeft;
      scrollLeft = node.scrollLeft;
    };
  
    const onMouseLeave = () => {
      isDown = false;
      node.classList.remove('cursor-grabbing');
    };
  
    const onMouseUp = () => {
      isDown = false;
      node.classList.remove('cursor-grabbing');
    };
  
    const onMouseMove = (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - node.offsetLeft;
      const walk = (x - startX) * 1.5; // speed factor
      node.scrollLeft = scrollLeft - walk;
    };
  
    node.addEventListener('mousedown', onMouseDown);
    node.addEventListener('mouseleave', onMouseLeave);
    node.addEventListener('mouseup', onMouseUp);
    node.addEventListener('mousemove', onMouseMove);
  
    return {
      destroy() {
        node.removeEventListener('mousedown', onMouseDown);
        node.removeEventListener('mouseleave', onMouseLeave);
        node.removeEventListener('mouseup', onMouseUp);
        node.removeEventListener('mousemove', onMouseMove);
      }
    };
  }
  