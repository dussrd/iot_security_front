export interface SelectOption {
  value: string;
  label: string;
}

export interface CityOption extends SelectOption {
  barrios: SelectOption[];
}

export const RIOHACHA_BARRIOS: SelectOption[] = [
  { value: 'centro', label: 'Centro' },
  { value: 'barrio_arriba', label: 'Barrio Arriba' },
  { value: 'barrio_abajo', label: 'Barrio Abajo' },
  { value: 'urbanizacion_el_faro', label: 'Urbanizacion El Faro' },
  { value: 'san_martin_de_porres', label: 'San Martin de Porres' },
  { value: 'los_remedios', label: 'Los Remedios' },
  { value: 'el_acueducto', label: 'El Acueducto' },
  { value: 'el_libertador', label: 'El Libertador' },
  { value: 'urbanizacion_el_tatual', label: 'Urbanizacion El Tatual' },
  { value: 'coquivacoa', label: 'Coquivacoa' },
  { value: 'padilla', label: 'Padilla' },
  { value: 'jose_antonio_galan', label: 'Jose Antonio Galan' },
  { value: 'urbanizacion_sol_tropical', label: 'Urbanizacion Sol Tropical' },
  { value: 'urbanizacion_terrazas_de_coquivacoa', label: 'Urbanizacion Terrazas de Coquivacoa' },
  { value: 'paraiso', label: 'Paraiso' },
  { value: 'guapuna', label: 'Guapuna' },
  { value: 'las_mercedes', label: 'Las Mercedes' },
  { value: 'luis_antonio_robles', label: 'Luis Antonio Robles' },
  { value: 'mediterraneo_i_y_ii', label: 'Mediterraneo I y II' },
  { value: 'doce_de_octubre', label: '12 de Octubre' },
  { value: 'marbella', label: 'Urbanizacion Marbella' },
  { value: 'san_tropel', label: 'San Tropel' },
  { value: 'nuevo_horizonte', label: 'Nuevo Horizonte' },
  { value: 'urbanizacion_portal_de_comfamiliar', label: 'Urbanizacion Portal de Comfamiliar' },
  { value: 'cooperativo', label: 'Cooperativo' },
  { value: 'nuevo_faro', label: 'Nuevo Faro' },
  { value: 'cooperativo_nuevo_faro', label: 'Cooperativo Nuevo Faro' },
  { value: 'la_napa', label: 'La Napa' },
  { value: 'edinson_deluque_pinto', label: 'Edinson Deluque Pinto' },
  { value: 'urbanizacion_manantial', label: 'Urbanizacion Manantial' },
  { value: 'urbanizacion_majayura_i_y_ii', label: 'Urbanizacion Majayura I y II' },
  { value: 'jorge_perez', label: 'Jorge Perez' },
  { value: 'cactus_i_y_ii', label: 'Cactus I y II' },
  { value: 'che_guevara', label: 'Che Guevara' },
  { value: 'las_tunas', label: 'Las Tunas' },
  { value: 'caribe', label: 'Caribe' },
  { value: 'san_martin_de_loba', label: 'San Martin de Loba' },
  { value: 'matajuna', label: 'Matajuna' },
  { value: 'aeropuerto', label: 'Aeropuerto' },
  { value: 'la_paz', label: 'La Paz' },
  { value: 'nazareth', label: 'Nazareth' },
  { value: 'obrero', label: 'Obrero' },
  { value: 'veinte_de_julio', label: '20 de Julio' },
  { value: 'san_francisco', label: 'San Francisco' },
  { value: 'rojas_pinilla', label: 'Rojas Pinilla' },
  { value: 'la_loma', label: 'La Loma' },
  { value: 'nuestra_senora_de_los_remedios', label: 'Nuestra Senora de los Remedios' },
  { value: 'jose_arnoldo_marin', label: 'Jose Arnoldo Marin' },
  { value: 'calancala', label: 'Calancala' },
  { value: 'las_villas', label: 'Las Villas' },
  { value: 'entre_rios', label: 'Entre Rios' },
  { value: 'los_medanos', label: 'Los Medanos' },
  { value: 'el_progreso', label: 'El Progreso' },
  { value: 'luis_eduardo_cuellar', label: 'Luis Eduardo Cuellar' },
  { value: 'villa_tatiana', label: 'Villa Tatiana' },
  { value: 'kepiagua', label: 'Kepiagua' },
  { value: 'la_cosecha', label: 'La Cosecha' },
  { value: 'boca_grande', label: 'Boca Grande' },
  { value: 'los_nogales', label: 'Los Nogales' },
  { value: 'san_judas', label: 'San Judas' },
  { value: 'el_comunitario', label: 'El Comunitario' },
  { value: 'los_olivos', label: 'Los Olivos' },
  { value: 'divino_nino', label: 'Divino Nino' },
  { value: 'la_esperanza', label: 'La Esperanza' },
  { value: 'quince_de_mayo', label: '15 de Mayo' },
  { value: 'comfamiliar_2000', label: 'Comfamiliar 2000' },
  { value: 'simon_bolivar', label: 'Simon Bolivar' },
  { value: 'eurare', label: 'Eurare' },
  { value: 'buganvilla', label: 'Buganvilla' },
  { value: 'camilo_torres', label: 'Camilo Torres' },
  { value: 'maria_eugenia_rojas', label: 'Maria Eugenia Rojas' },
  { value: 'rancheria', label: 'Rancheria' },
  { value: 'villa_laura', label: 'Villa Laura' },
  { value: 'urbanizacion_villa_armando', label: 'Urbanizacion Villa Armando' },
  { value: 'urbanizacion_bella_vista', label: 'Urbanizacion Bella Vista' },
  { value: 'urbanizacion_solmar', label: 'Urbanizacion Solmar' },
  { value: 'buenos_aires', label: 'Buenos Aires' },
  { value: 'los_cerezos', label: 'Los Cerezos' },
  { value: 'siete_de_agosto', label: '7 de Agosto' },
  { value: 'urbanizacion_pareigua', label: 'Urbanizacion Pareigua' },
  { value: 'claudia_catalina', label: 'Claudia Catalina' },
  { value: 'pilar_del_rio', label: 'Pilar del Rio' },
  { value: 'urbanizacion_wuetapia', label: 'Urbanizacion Wuetapia' },
  { value: 'villa_comfamiliar', label: 'Urbanizacion Villa Comfamiliar' },
  { value: 'urbanizacion_villa_del_mar', label: 'Urbanizacion Villa del Mar' },
  { value: 'urbanizacion_villa_tatiana', label: 'Urbanizacion Villa Tatiana' },
  { value: 'villa_fatima', label: 'Villa Fatima' },
  { value: 'ciudadela_el_dividivi', label: 'Ciudadela El Dividivi' },
  { value: 'los_almendros', label: 'Los Almendros' },
  { value: 'los_loteros', label: 'Los Loteros' },
  { value: 'villa_sharin', label: 'Villa Sharin' },
  { value: 'urbanizacion_la_floresta', label: 'Urbanizacion La Floresta' },
  { value: 'hugo_zuniga', label: 'Hugo Zuniga' },
  { value: 'urbanizacion_san_judas_tadeo', label: 'Urbanizacion San Judas Tadeo' },
  { value: 'urbanizacion_san_isidro', label: 'Urbanizacion San Isidro' },
  { value: 'villa_yolima', label: 'Villa Yolima' },
  { value: 'villa_jardin', label: 'Villa Jardin' },
  { value: 'treinta_y_uno_de_octubre', label: '31 de Octubre' },
  { value: 'urbanizacion_la_mano_de_dios', label: 'Urbanizacion La Mano de Dios' },
  { value: 'nuevo_milenio', label: 'Nuevo Milenio' },
  { value: 'urbanizacion_villa_aurora', label: 'Urbanizacion Villa Aurora' },
  { value: 'urbanizacion_taguaira', label: 'Urbanizacion Taguaira' },
  { value: 'la_lucha', label: 'La Lucha' },
  { value: 'la_luchita', label: 'La Luchita' },
  { value: 'la_provincia', label: 'La Provincia' },
  { value: 'fundacion_casa_del_abuelo', label: 'Fundacion Casa del Abuelo' },
];

export const CITY_NEIGHBORHOODS: CityOption[] = [
  {
    value: 'riohacha',
    label: 'Riohacha',
    barrios: RIOHACHA_BARRIOS,
  },
  {
    value: 'maicao',
    label: 'Maicao',
    barrios: [
      { value: 'centro', label: 'Centro' },
      { value: 'san_francisco', label: 'San Francisco' },
      { value: 'la_floresta', label: 'La Floresta' },
      { value: 'el_carmen', label: 'El Carmen' },
      { value: 'villa_amelia', label: 'Villa Amelia' },
    ],
  },
  {
    value: 'barranquilla',
    label: 'Barranquilla',
    barrios: [
      { value: 'el_prado', label: 'El Prado' },
      { value: 'alto_prado', label: 'Alto Prado' },
      { value: 'riomar', label: 'Riomar' },
      { value: 'boston', label: 'Boston' },
      { value: 'ciudad_jardin', label: 'Ciudad Jardin' },
    ],
  },
  {
    value: 'bogota',
    label: 'Bogota',
    barrios: [
      { value: 'chapinero', label: 'Chapinero' },
      { value: 'usaquen', label: 'Usaquen' },
      { value: 'suba', label: 'Suba' },
      { value: 'teusaquillo', label: 'Teusaquillo' },
      { value: 'kennedy', label: 'Kennedy' },
    ],
  },
  {
    value: 'medellin',
    label: 'Medellin',
    barrios: [
      { value: 'el_poblado', label: 'El Poblado' },
      { value: 'laureles', label: 'Laureles' },
      { value: 'belen', label: 'Belen' },
      { value: 'robledo', label: 'Robledo' },
      { value: 'guayabal', label: 'Guayabal' },
    ],
  },
];

export const CITY_OPTIONS = CITY_NEIGHBORHOODS.map(({ value, label }) => ({ value, label }));

export function neighborhoodsForCity(city: string): SelectOption[] {
  return CITY_NEIGHBORHOODS.find((item) => item.value === city)?.barrios ?? [];
}

export function cityLabel(value: unknown): string {
  return CITY_OPTIONS.find((item) => item.value === value)?.label ?? String(value ?? '');
}

export function barrioLabel(value: unknown): string {
  const options = CITY_NEIGHBORHOODS.flatMap((city) => city.barrios);
  return options.find((item) => item.value === value)?.label ?? String(value ?? '');
}
