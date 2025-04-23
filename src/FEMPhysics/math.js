import {
    abs, Break,
    cross,
    div, dot,
    float,
    Fn, If,
    int, length,
    Loop,
    mat3,
    mul,
    normalize,
    sin,
    uint,
    uvec3,
    vec2,
    vec3,
    vec4
} from "three/tsl";

export const murmurHash13 = /*#__PURE__*/ Fn( ( [ src_immutable ] ) => {
    const src = uvec3( src_immutable.add(1073741823) ).toVar(); // int to uint
    const M = uint( int( 0x5bd1e995 ) );
    const h = uint( uint( 1190494759 ) ).toVar();
    src.mulAssign( M );
    src.bitXorAssign( src.shiftRight( uvec3( 24 ) ) );
    src.mulAssign( M );
    h.mulAssign( M );
    h.bitXorAssign( src.x );
    h.mulAssign( M );
    h.bitXorAssign( src.y );
    h.mulAssign( M );
    h.bitXorAssign( src.z );
    h.bitXorAssign( h.shiftRight( uint( 13 ) ) );
    h.mulAssign( M );
    h.bitXorAssign( h.shiftRight( uint( 15 ) ) );
    return h;
} ).setLayout( {
    name: 'murmurHash13',
    type: 'uint',
    inputs: [
        { name: 'src', type: 'ivec3' }
    ]
} );

export const rotationToQuaternion = /*#__PURE__*/ Fn( ( [ axis_immutable, angle_immutable ] ) => {

    const angle = float( angle_immutable ).toVar();
    const axis = vec3( axis_immutable ).toVar();
    const half_angle = float( angle.mul( 0.5 ) ).toVar();
    const s = vec2( sin( vec2( half_angle, half_angle.add( Math.PI * 0.5 ) ) ) ).toVar();

    return vec4( axis.mul( s.x ), s.y );

} ).setLayout( {
    name: 'rotationToQuaternion',
    type: 'vec4',
    inputs: [
        { name: 'axis', type: 'vec3' },
        { name: 'angle', type: 'float' }
    ]
} );

export const rotateByQuat = /*#__PURE__*/ Fn( ( [ pos_immutable, quat_immutable ] ) => {

    const quat = vec4( quat_immutable ).toVar();
    const pos = vec3( pos_immutable ).toVar();

    return pos.add( mul( 2.0, cross( quat.xyz, cross( quat.xyz, pos ).add( quat.w.mul( pos ) ) ) ) );

} ).setLayout( {
    name: 'rotateByQuat',
    type: 'vec3',
    inputs: [
        { name: 'pos', type: 'vec3' },
        { name: 'quat', type: 'vec4' }
    ]
} );

export const quat_conj = /*#__PURE__*/ Fn( ( [ q_immutable ] ) => {

    const q = vec4( q_immutable ).toVar();

    return normalize( vec4( q.x.negate(), q.y.negate(), q.z.negate(), q.w ) );

} ).setLayout( {
    name: 'quat_conj',
    type: 'vec4',
    inputs: [
        { name: 'q', type: 'vec4' }
    ]
} );

export const quat_mult = /*#__PURE__*/ Fn( ( [ q1_immutable, q2_immutable ] ) => {

    const q2 = vec4( q2_immutable ).toVar();
    const q1 = vec4( q1_immutable ).toVar();
    const qr = vec4().toVar();
    qr.x.assign( q1.w.mul( q2.x ).add( q1.x.mul( q2.w ) ).add( q1.y.mul( q2.z ).sub( q1.z.mul( q2.y ) ) ) );
    qr.y.assign( q1.w.mul( q2.y ).sub( q1.x.mul( q2.z ) ).add( q1.y.mul( q2.w ) ).add( q1.z.mul( q2.x ) ) );
    qr.z.assign( q1.w.mul( q2.z ).add( q1.x.mul( q2.y ).sub( q1.y.mul( q2.x ) ) ).add( q1.z.mul( q2.w ) ) );
    qr.w.assign( q1.w.mul( q2.w ).sub( q1.x.mul( q2.x ) ).sub( q1.y.mul( q2.y ) ).sub( q1.z.mul( q2.z ) ) );

    return qr;

} ).setLayout( {
    name: 'quat_mult',
    type: 'vec4',
    inputs: [
        { name: 'q1', type: 'vec4' },
        { name: 'q2', type: 'vec4' }
    ]
} );

export const extractRotation = /*#__PURE__*/ Fn( ( [ A_immutable, q_immutable ] ) => {

    const q = vec4( q_immutable ).toVar();
    const A = mat3( A_immutable ).toVar();

    Loop( { start: int( 0 ), end: int( 9 ), name: 'iter' }, ( { iter } ) => {

        const X = vec3( rotateByQuat( vec3( 1.0, 0.0, 0.0 ), q ) ).toVar();
        const Y = vec3( rotateByQuat( vec3( 0.0, 1.0, 0.0 ), q ) ).toVar();
        const Z = vec3( rotateByQuat( vec3( 0.0, 0.0, 1.0 ), q ) ).toVar();
        const omega = vec3( cross( X, A.element( int( 0 ) ) ).add( cross( Y, A.element( int( 1 ) ) ) ).add( cross( Z, A.element( int( 2 ) ) ) ).mul( div( 1.0, abs( dot( X, A.element( int( 0 ) ) ).add( dot( Y, A.element( int( 1 ) ) ) ).add( dot( Z, A.element( int( 2 ) ) ) ).add( 0.000000001 ) ) ) ) ).toVar();
        const w = float( length( omega ) ).toVar();

        If( w.lessThan( 0.000000001 ), () => {
            Break();
        } );

        q.assign( quat_mult( rotationToQuaternion( omega.div( w ), w ), q ) );

    } );

    return q;

} ).setLayout( {
    name: 'extractRotation',
    type: 'vec4',
    inputs: [
        { name: 'A', type: 'mat3' },
        { name: 'q', type: 'vec4' }
    ]
} );

