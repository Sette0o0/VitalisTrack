package com.vitalistrack.wellbeing
import org.junit.Test
import org.junit.Assert.*
class HeartRatePacketTest {
 @Test fun parses8And16BitMeasurements(){assertEquals(100,HeartRatePacket.decode(byteArrayOf(0,100)));assertEquals(300,HeartRatePacket.decode(byteArrayOf(1,44,1)))}
 @Test fun rejectsMissingContactZeroAndTruncation(){assertNull(HeartRatePacket.decode(byteArrayOf()));assertNull(HeartRatePacket.decode(byteArrayOf(1,44)));assertNull(HeartRatePacket.decode(byteArrayOf(0,0)));assertNull(HeartRatePacket.decode(byteArrayOf(4,100)));assertEquals(100,HeartRatePacket.decode(byteArrayOf(6,100)))}
}
