package com.vitalistrack.wellbeing
import android.Manifest
import android.bluetooth.*
import android.bluetooth.le.*
import android.content.*
import android.content.pm.PackageManager
import android.net.Uri
import android.os.*
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.UUID

class VitalisWellbeingModule:Module(){
 private val ctx get()=requireNotNull(appContext.reactContext)
 private val handler=Handler(Looper.getMainLooper())
 private var scanner:BluetoothLeScanner?=null
 private var gatt:BluetoothGatt?=null
 private val heartService=UUID.fromString("0000180d-0000-1000-8000-00805f9b34fb")
 private val heartChar=UUID.fromString("00002a37-0000-1000-8000-00805f9b34fb")
 private val cccd=UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")
 private var lastSecond=-1L
 private val scanCallback=object:ScanCallback(){
  override fun onScanResult(type:Int,result:ScanResult){try{sendEvent("onBleDevice",mapOf("id" to result.device.address,"name" to (result.device.name?:"Sensor cardíaco")))}catch(_:SecurityException){disconnect()}}
  override fun onScanFailed(code:Int){sendEvent("onBleState",mapOf("state" to "scan-failed"));stopScan()}
 }
 private fun stopScan(){try{scanner?.stopScan(scanCallback)}catch(_:SecurityException){};scanner=null;handler.removeCallbacksAndMessages(null)}
 private fun disconnect(){stopScan();try{gatt?.disconnect();gatt?.close()}catch(_:SecurityException){};gatt=null;lastSecond=-1}
 private fun emitHeart(value:ByteArray){
  val bpm=decodeHeartRate(value)?:return;val second=SystemClock.elapsedRealtime()/1000
  if(second==lastSecond)return;lastSecond=second;sendEvent("onHeartRate",mapOf("bpm" to bpm,"second" to second))
 }
 private val callback=object:BluetoothGattCallback(){
  override fun onConnectionStateChange(g:BluetoothGatt,status:Int,newState:Int){
   if(g!==gatt)return
   if(status==BluetoothGatt.GATT_SUCCESS&&newState==BluetoothProfile.STATE_CONNECTED){sendEvent("onBleState",mapOf("state" to "connected"));try{g.discoverServices()}catch(_:SecurityException){disconnect()}}
   else if(newState==BluetoothProfile.STATE_DISCONNECTED){g.close();gatt=null;sendEvent("onBleState",mapOf("state" to "disconnected"))}
  }
  override fun onServicesDiscovered(g:BluetoothGatt,status:Int){
   if(g!==gatt)return
   val characteristic=g.getService(heartService)?.getCharacteristic(heartChar)
   val descriptor=characteristic?.getDescriptor(cccd)
   if(status!=BluetoothGatt.GATT_SUCCESS||characteristic==null||descriptor==null){disconnect();sendEvent("onBleState",mapOf("state" to "unsupported"));return}
   try{
    g.setCharacteristicNotification(characteristic,true)
    if(Build.VERSION.SDK_INT>=33)g.writeDescriptor(descriptor,BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE)
    else{descriptor.value=BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE;g.writeDescriptor(descriptor)}
   }catch(_:SecurityException){disconnect()}
  }
  override fun onDescriptorWrite(g:BluetoothGatt,d:BluetoothGattDescriptor,status:Int){if(g===gatt)sendEvent("onBleState",mapOf("state" to if(status==BluetoothGatt.GATT_SUCCESS)"reading" else "subscribe-failed"))}
  @Deprecated("API 33 callback preferred")
  override fun onCharacteristicChanged(g:BluetoothGatt,c:BluetoothGattCharacteristic){if(Build.VERSION.SDK_INT<33&&g===gatt&&c.uuid==heartChar)emitHeart(c.value?:return)}
  override fun onCharacteristicChanged(g:BluetoothGatt,c:BluetoothGattCharacteristic,value:ByteArray){if(g===gatt&&c.uuid==heartChar)emitHeart(value)}
 }
 override fun definition()=ModuleDefinition {
  Name("VitalisWellbeing");Events("onBleDevice","onHeartRate","onBleState")
  AsyncFunction("configure") {user:String,json:String->WellbeingScheduler.configure(ctx,user,json)}
  AsyncFunction("clearAccount") {disconnect();WellbeingScheduler.clear(ctx)}
  AsyncFunction("status") {WellbeingScheduler.status(ctx)}
  AsyncFunction("startFocus") {owner:String,minutes:Int->WellbeingScheduler.startFocus(ctx,owner,minutes)}
  AsyncFunction("stopFocus") {owner:String->WellbeingScheduler.stopFocus(ctx,owner)}
  AsyncFunction("openPolicySettings") {ctx.startActivity(Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))}
  AsyncFunction("openExactSettings") {if(Build.VERSION.SDK_INT>=31)ctx.startActivity(Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,Uri.parse("package:"+ctx.packageName)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))}
  AsyncFunction("scan") {
   stopScan();val manager=ctx.getSystemService(BluetoothManager::class.java);val adapter=manager?.adapter
   check(adapter!=null&&adapter.isEnabled){"Ative o Bluetooth para buscar sensores."}
   scanner=adapter.bluetoothLeScanner;check(scanner!=null){"Bluetooth BLE indisponível"}
   scanner!!.startScan(listOf(ScanFilter.Builder().setServiceUuid(ParcelUuid(heartService)).build()),ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build(),scanCallback)
   handler.postDelayed({stopScan();sendEvent("onBleState",mapOf("state" to "scan-complete"))},15000)
  }
  AsyncFunction("connect") {id:String->
   disconnect();val adapter=ctx.getSystemService(BluetoothManager::class.java).adapter
   gatt=adapter.getRemoteDevice(id).connectGatt(ctx,false,callback,BluetoothDevice.TRANSPORT_LE)
  }
  AsyncFunction("disconnect") {disconnect()}
  OnActivityEntersBackground {disconnect()}
  OnDestroy {disconnect()}
 }
 companion object {
  fun decodeHeartRate(value:ByteArray):Int? = HeartRatePacket.decode(value)
 }
}
