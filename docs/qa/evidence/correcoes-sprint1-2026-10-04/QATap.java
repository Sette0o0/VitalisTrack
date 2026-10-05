import android.os.SystemClock;
import android.view.MotionEvent;
import android.view.InputEvent;
public class QATap {
 public static void main(String[] args) throws Exception {
  Class<?> manager = Class.forName("android.hardware.input.InputManager");
  Object instance = manager.getMethod("getInstance").invoke(null);
  java.lang.reflect.Method inject = manager.getMethod("injectInputEvent", InputEvent.class, int.class);
  MotionEvent.PointerProperties p = new MotionEvent.PointerProperties(); p.id=0; p.toolType=MotionEvent.TOOL_TYPE_FINGER;
  MotionEvent.PointerCoords c = new MotionEvent.PointerCoords(); c.x=Float.parseFloat(args[0]);c.y=Float.parseFloat(args[1]);c.pressure=1;c.size=1;
  long down = SystemClock.uptimeMillis();
  for(int action : new int[]{MotionEvent.ACTION_DOWN,MotionEvent.ACTION_UP}) {
   MotionEvent e=MotionEvent.obtain(down,SystemClock.uptimeMillis(),action,1,new MotionEvent.PointerProperties[]{p},new MotionEvent.PointerCoords[]{c},0,0,1,1,0,0,0x1002,0);
   System.out.println(inject.invoke(instance,e,2)); e.recycle(); SystemClock.sleep(100);
  }
 }
}
