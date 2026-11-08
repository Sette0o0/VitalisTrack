package com.vitalistrack.wellbeing
object HeartRatePacket {
 fun decode(value:ByteArray):Int? {
  if(value.size<2)return null
  val flags=value[0].toInt() and 255
  if(flags and 4 != 0 && flags and 2 == 0)return null
  val bpm=if(flags and 1 != 0){if(value.size<3)return null;(value[1].toInt() and 255) or ((value[2].toInt() and 255) shl 8)}else value[1].toInt() and 255
  return bpm.takeIf{it>0}
 }
}
