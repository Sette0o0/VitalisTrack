package com.vitalistrack.wellbeing

import android.app.Activity
import android.os.Bundle
import android.os.Process
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
import android.widget.Button
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import java.io.File
import java.security.MessageDigest
import org.json.JSONObject

/** Test APK only: accepts files exclusively from the synthetic QA application's provider. */
class QaFileReceiverActivity : Activity() {
 override fun onCreate(savedInstanceState: Bundle?) {
  super.onCreate(savedInstanceState)
  val layout=LinearLayout(this).apply { orientation=LinearLayout.VERTICAL;setPadding(20,20,20,20) }
  setContentView(ScrollView(this).apply { addView(layout) })
  fun text(value:String){layout.addView(TextView(this).apply{text=value;textSize=18f;setTextColor(Color.BLACK)})}
  try {
   @Suppress("DEPRECATION")
   val source:Uri?=if(intent.action==Intent.ACTION_SEND)intent.getParcelableExtra(Intent.EXTRA_STREAM) else intent.data
   require(source!=null && source.scheme=="content" && source.authority?.startsWith("com.vitalistrack.qa.")==true){"Only the QA provider is allowed"}
   val read=checkUriPermission(source,Process.myPid(),Process.myUid(),Intent.FLAG_GRANT_READ_URI_PERMISSION)==PackageManager.PERMISSION_GRANTED
   val write=checkUriPermission(source,Process.myPid(),Process.myUid(),Intent.FLAG_GRANT_WRITE_URI_PERMISSION)==PackageManager.PERMISSION_GRANTED
   require(read && !write){"Expected temporary read-only permission"}
   val mime=intent.type?:"application/octet-stream"
   val extension=when(mime){"application/pdf"->"pdf";"application/json"->"json";"text/csv"->"csv";else->"bin"}
   val file=File(filesDir,"received-${System.currentTimeMillis()}.$extension")
   contentResolver.openInputStream(source)!!.use { input->file.outputStream().use { input.copyTo(it,65536) } }
   val digest=MessageDigest.getInstance("SHA-256")
   file.inputStream().use { input->val buffer=ByteArray(65536);while(true){val n=input.read(buffer);if(n<0)break;digest.update(buffer,0,n)} }
   val report=JSONObject().put("action",intent.action).put("mime",mime).put("size",file.length()).put("sha256",digest.digest().joinToString(""){"%02x".format(it)}).put("readGranted",read).put("writeGranted",write).put("file",file.name)
   text("Arquivo QA recebido");text("Tipo: $mime");text("Tamanho: ${file.length()} bytes");text("Permissão: somente leitura")
   if(mime=="application/pdf") {
    ParcelFileDescriptor.open(file,ParcelFileDescriptor.MODE_READ_ONLY).use { fd->PdfRenderer(fd).use { renderer->
     report.put("pdfPages",renderer.pageCount);text("PDF: ${renderer.pageCount} páginas")
     renderer.openPage(0).use { page->val bitmap=Bitmap.createBitmap(page.width,page.height,Bitmap.Config.ARGB_8888);bitmap.eraseColor(Color.WHITE);page.render(bitmap,null,null,PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
      layout.addView(ImageView(this).apply {setImageBitmap(bitmap);adjustViewBounds=true;contentDescription="Primeira página do PDF recebido"}) }
    } }
   }
   File(filesDir,"received-latest.json").writeText(report.toString())
  } catch(e:Exception) {
   text("Falha no receptor QA: "+e.javaClass.simpleName)
   File(filesDir,"received-latest.json").writeText(JSONObject().put("error",e.javaClass.simpleName).toString())
  }
  layout.addView(Button(this).apply{text="Voltar ao VitalisTrack";setOnClickListener{finish()}})
 }
}
