package com.vitalistrack.wellbeing
import android.app.Instrumentation
import android.app.Activity
import android.os.Bundle
import android.graphics.Rect
import android.view.accessibility.AccessibilityNodeInfo
import android.util.Xml
import java.io.StringWriter
class QaDumpTest {
 @org.junit.Test fun dump(){
  val instrumentation=androidx.test.platform.app.InstrumentationRegistry.getInstrumentation()
  val uiAutomation=instrumentation.uiAutomation
  val result=Bundle()
  try{
   val info=uiAutomation.serviceInfo;info.flags=info.flags or android.accessibilityservice.AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS or android.accessibilityservice.AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS;uiAutomation.serviceInfo=info
   var root:AccessibilityNodeInfo?=null
   for(attempt in 0 until 20){
    root=uiAutomation.windows.mapNotNull{it.root}.firstOrNull{it.packageName?.toString()=="com.vitalistrack.qa"}
    if(root!=null)break
    val active=uiAutomation.rootInActiveWindow
    if(active?.packageName?.toString()=="com.vitalistrack.qa"){root=active;break}
    Thread.sleep(100)
   }
   check(root!=null && root.packageName?.toString()=="com.vitalistrack.qa"){"Only the QA application may be inspected"}
   val text=StringWriter();val xml=Xml.newSerializer();xml.setOutput(text);xml.startDocument("UTF-8",true);xml.startTag(null,"hierarchy")
   fun node(n:AccessibilityNodeInfo){
    if(!n.isVisibleToUser)return
    xml.startTag(null,"node");val rect=Rect();n.getBoundsInScreen(rect)
    for((key,value)in mapOf("text" to (n.text?.toString()?:""),"content-desc" to (n.contentDescription?.toString()?:""),"resource-id" to (n.viewIdResourceName?:""),"class" to (n.className?.toString()?:""),"package" to (n.packageName?.toString()?:""),"bounds" to "[${rect.left},${rect.top}][${rect.right},${rect.bottom}]","focused" to n.isFocused.toString(),"scrollable" to n.isScrollable.toString(),"enabled" to n.isEnabled.toString(),"checked" to n.isChecked.toString()))xml.attribute(null,key,value)
    for(i in 0 until n.childCount)n.getChild(i)?.let{node(it)};xml.endTag(null,"node")
   }
   node(root!!);xml.endTag(null,"hierarchy");xml.endDocument();result.putString("xml",text.toString());instrumentation.sendStatus(2,result)
  }catch(e:Exception){result.putString("error",e.javaClass.simpleName);throw e}
 }
}
