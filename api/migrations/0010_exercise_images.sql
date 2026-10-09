UPDATE exercises
SET image_path = CASE id
  WHEN '2f7d9b0a-8c11-4d31-9d8a-4c51c6aef001' THEN 'exercises/hip-thrust.svg'
  WHEN '2f7d9b0a-8c11-4d31-9d8a-4c51c6aef002' THEN 'exercises/bulgaras.svg'
  WHEN '2f7d9b0a-8c11-4d31-9d8a-4c51c6aef003' THEN 'exercises/peso-muerto-rumano.svg'
  WHEN '2f7d9b0a-8c11-4d31-9d8a-4c51c6aef004' THEN 'exercises/peso-muerto-una-pierna.svg'
  WHEN '2f7d9b0a-8c11-4d31-9d8a-4c51c6aef005' THEN 'exercises/femoral.svg'
  WHEN '2f7d9b0a-8c11-4d31-9d8a-4c51c6aef006' THEN 'exercises/plancha-frontal.svg'
  WHEN '2f7d9b0a-8c11-4d31-9d8a-4c51c6aef007' THEN 'exercises/crunch.svg'
  WHEN '2f7d9b0a-8c11-4d31-9d8a-4c51c6aef008' THEN 'exercises/sentadilla.svg'
  WHEN '2f7d9b0a-8c11-4d31-9d8a-4c51c6aef009' THEN 'exercises/prensa-piernas.svg'
  WHEN '2f7d9b0a-8c11-4d31-9d8a-4c51c6aef00a' THEN 'exercises/elevacion-gemelos.svg'
  WHEN '2f7d9b0a-8c11-4d31-9d8a-4c51c6aef00b' THEN 'exercises/remo-sentado.svg'
  WHEN '2f7d9b0a-8c11-4d31-9d8a-4c51c6aef00c' THEN 'exercises/press-pecho.svg'
  ELSE image_path
END
WHERE is_builtin = 1;
