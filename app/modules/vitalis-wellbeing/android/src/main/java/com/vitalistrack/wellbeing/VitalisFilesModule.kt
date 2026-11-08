package com.vitalistrack.wellbeing

import android.content.Intent
import android.net.Uri
import android.util.Base64
import android.util.Base64OutputStream
import androidx.core.content.FileProvider
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileOutputStream
import java.security.MessageDigest

class VitalisFilesModule : Module() {
 private val ctx get() = requireNotNull(appContext.reactContext)
 private fun uri(value:String):Uri = Uri.parse(value).also { require(it.scheme=="file" || it.scheme=="content") }
 private fun local(value:String):File {
  val f=File(requireNotNull(uri(value).path)).canonicalFile
  require(f.path.startsWith(ctx.filesDir.canonicalPath+"/") || f.path.startsWith(ctx.cacheDir.canonicalPath+"/"))
  return f
 }
 override fun definition() = ModuleDefinition {
  Name("VitalisFiles")
  AsyncFunction("info") { source:String ->
   val digest=MessageDigest.getInstance("SHA-256");var count=0L;var header=byteArrayOf()
   ctx.contentResolver.openInputStream(uri(source))!!.use { input ->
    val buffer=ByteArray(65536);while(true){val n=input.read(buffer);if(n<0)break;digest.update(buffer,0,n);if(header.size<16)header+=buffer.copyOfRange(0,minOf(n,16-header.size));count+=n}
   }
   mapOf("headerHex" to header.joinToString(""){"%02x".format(it)},"size" to count,"sha256" to digest.digest().joinToString(""){"%02x".format(it)})
  }
  AsyncFunction("appendText") { destination:String,text:String -> FileOutputStream(local(destination),true).use { it.write(text.toByteArray(Charsets.UTF_8)) } }
  AsyncFunction("appendBase64") { source:String,destination:String ->
   Base64OutputStream(FileOutputStream(local(destination),true),Base64.NO_WRAP).use { output -> ctx.contentResolver.openInputStream(uri(source))!!.use { it.copyTo(output,65536) } }
  }
  AsyncFunction("copyToUri") { source:String,destination:String ->
   require(uri(destination).scheme=="content")
   ctx.contentResolver.openInputStream(uri(source))!!.use { input -> ctx.contentResolver.openOutputStream(uri(destination),"wt")!!.use { input.copyTo(it,65536) } }
  }
  AsyncFunction("open") { source:String,mime:String ->
   val content=FileProvider.getUriForFile(ctx,ctx.packageName+".FileSystemFileProvider",local(source))
   ctx.startActivity(Intent(Intent.ACTION_VIEW).setDataAndType(content,mime).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK))
  }
 }
}
