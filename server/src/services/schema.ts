/** Participant-visible feature schema (public information: identical to the columns of train.csv). */
export const FEATURE_SCHEMA = {
  target: 'sort_bin',
  targetRange: [65, 90],
  idColumn: 'id',
  categorical: ['material', 'supplier', 'coating', 'line_id', 'shift'],
  numeric: [
    'batch_number', 'length_mm', 'width_mm', 'thickness_mm', 'weight_g', 'hardness_hv', 'surface_roughness_um',
    'conductivity_iacs', 'magnetic_response_idx', 'ambient_temp_c', 'humidity_pct', 'vibration_rms', 'inspection_time_s',
  ],
  sklearnVersion: '1.6.1',
  notes: [
    'Upload a joblib-dumped sklearn Pipeline that accepts the raw feature columns (all 18, without id and sort_bin).',
    'Do the imputing / encoding / scaling inside the Pipeline. Use challenge_features.add_engineered_features via FunctionTransformer for engineered features.',
    'The model must predict an integer ASCII code between 65 and 90.',
  ],
};

