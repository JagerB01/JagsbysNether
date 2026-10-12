# Additional rightward clearance (v0.2.21)

This adds another camera-right translation to the accepted pose. Rotation,
scale and third-person pose are unchanged. The preview is approximate;
the prior in-game shift was smaller than predicted by the editor camera.
The scripted line anchor is now derived from the third-person model tip.
It is not a true client-bone attachment, especially in first person.
Reel-in no longer plays the casting sound; catch sounds remain.
