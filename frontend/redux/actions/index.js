import firebase from 'firebase';
require('firebase/firestore')
import { USER_STATE_CHANGE, USER_POSTS_STATE_CHANGE, USER_FOLLOWING_STATE_CHANGE, USERS_DATA_STATE_CHANGE, USERS_POSTS_STATE_CHANGE, CLEAR_DATA, USERS_LIKES_STATE_CHANGE } from '../constants/index';
import { SnapshotViewIOSComponent } from 'react-native';

// 사용자가 바뀌면 redux에 저장된 모든 데이터를 초기화해서 새로 로그인한 사용자에 맞게 Feed 최신화할 수 있게 만드는 기초 작업
// 새로고침 같은 기능
export function clearData(params) {
    return ((dispatch) => {
        dispatch({type: CLEAR_DATA})
    })
}

export function fetchUser() {
    return((dispatch) => {
        firebase.firestore()                        // firestore에 접근하여
        .collection("users")                        // 'users' 컬렉션에 접근하고
        .doc(firebase.auth().currentUser.uid)       // currentUser의 uid를 기반으로 정보를 확인
        .get()                                      // 확인한 것을 가지고 옴
        .then((snapshot) => {                       // 확인한 정보를 snapshot(통채로 들고옴)
            if (snapshot.exists) {                  // 가지고 온게 있다면, dispatch 실행(reducer 자동 호출, state 최신화)
                dispatch({type: USER_STATE_CHANGE, currentUser: snapshot.data()})
            }
            else {
                console.log('Does Not Exist');
            }
        })
    })
}

// 사용자가 새로 post한게 생기면 trigger되는 함수 
export function fetchUserPosts() {
    return((dispatch) => {
        firebase.firestore()                        // firestore에 접근하여
        .collection("posts")                        // 'posts' 컬렉션에 접근하고
        .doc(firebase.auth().currentUser.uid)       // currentUser의 uid를 기반의 doc에서
        .collection("userPosts")                    // userPosts 컬렉션에 접근
        .orderBy("creation", "desc")                // 생성된 날짜를 기반으로 내림차순 정렬 (timestamp는 integer로 구성돼서 정렬이 가능함)
        .get()                                      // 확인한 것을 가지고 옴
        .then((snapshot) => {                       // 확인한 정보를 snapshot(통채로 들고옴)
            let posts = snapshot.docs.map(doc => {  // map은 docs를 iterate(순차적으로 접근)해서 원하는 정보만 뽑아서 배열로 리턴한다.
                const data = doc.data();
                const id = doc.id;
                return {id, ...data}
            })
            dispatch({type: USER_POSTS_STATE_CHANGE, posts})
        })
    })
}

// userFollow 컬렉션에 변화가 생기면 trigger 되는 함수
export function fetchUserFollowing() {
    return((dispatch) => {
        firebase.firestore()                        
        .collection("following")                        
        .doc(firebase.auth().currentUser.uid)       
        .collection("userFollowing")                   
        .onSnapshot((snapshot) => {                       
            let following = snapshot.docs.map(doc => { 
                const id = doc.id;
                return id
            })
            dispatch({type: USER_FOLLOWING_STATE_CHANGE, following});
            for(let i = 0; i < following.length; i++) {
                dispatch(fetchUsersData(following[i], true));
            }
        })
    })
}

// 사용자가 follow 중인 유저들을 한 번에 확인하게 만들어주는 함수
// firestore는 이런 함수가 내장돼있지 않아서 따로 만들어줘야 한다.
// usersState에 없는 유저가 사용자의 follow 배열에서 있다면 그 유저를 usersState에 추가 
export function fetchUsersData(uid, getPosts) {
    return ((dispatch, getState) => {

        // users 배열에서의 uid와 함수 인자로 들어온 uid가 일치하다면 true를 리턴
        const found = getState().usersState.users.some(el => el.uid === uid);

        if (!found) {                                   // users배열에 함수 인자로 들어온 uid가 없다면
            firebase.firestore()                        // firestore에 접근하여
            .collection("users")                        // 'users' 컬렉션에 접근하고
            .doc(uid)                                   // 함수 인자의 uid를 기반으로 정보를 확인
            .get()                                      // 확인한 것을 가지고 옴
            .then((snapshot) => {                       // 확인한 정보를 snapshot(통채로 들고옴)
                if (snapshot.exists) {                  // 가지고 온게 있다면, dispatch 실행(reducer 자동 호출, state 최신화)
                    let user = snapshot.data();
                    user.uid = snapshot.id;
                    dispatch({type: USERS_DATA_STATE_CHANGE, user}); // users State에 새로운 user 추가 
                }
                else {
                    console.log('Does Not Exist');
                }
            })
            if (getPosts) {
                dispatch(fetchUsersFollowingPosts(uid));
            }
        }
    })
}

// 팔로우한 유저의 post들을 가져오는 함수
export function fetchUsersFollowingPosts(uid) {
    return((dispatch, getState) => {
        firebase.firestore()                        // firestore에 접근하여
        .collection("posts")                        // 'posts' 컬렉션에 접근하고
        .doc(uid)                                   // currentUser의 uid를 기반의 doc에서
        .collection("userPosts")                    // userPosts 컬렉션에 접근
        .orderBy("creation", "desc")                // 생성된 날짜를 기반으로 내림차순 정렬 (timestamp는 integer로 구성돼서 정렬이 가능함)
        .get()                                      // 확인한 것을 가지고 옴
        .then((snapshot) => {                       // 확인한 정보를 snapshot(통채로 들고옴)
            const uid = snapshot.query.EP.path.segments[1];
            const user = getState().usersState.users.find(el => el.uid === uid);
            
            let posts = snapshot.docs.map(doc => {  // map은 docs를 iterate(순차적으로 접근)해서 원하는 정보만 뽑아서 배열로 리턴한다.
                const data = doc.data();
                const id = doc.id;
                return {id, ...data, user}
            })
            for (let i = 0; i < posts.length; i++) {
                dispatch(fetchUsersFollowingLikes(uid, posts[i].id));
            }
            dispatch({type: USERS_POSTS_STATE_CHANGE, posts, uid})  // 새로운게 발견되면 usersLoaded가 +1 되고 새로 발견한 데이터를 기존 State에 추가
        })
    })
}

export function fetchUsersFollowingLikes(uid, postId) {
    return((dispatch, getState) => {
        firebase.firestore()                        // firestore에 접근하여
        .collection("posts")                        // 'posts' 컬렉션에 접근하고
        .doc(uid)                                   // currentUser의 uid를 기반의 doc에서
        .collection("userPosts")                    // userPosts 컬렉션에 접근
        .doc(postId)
        .collection("likes")
        .doc(firebase.auth().currentUser.uid)
        .onSnapshot((snapshot) => {                       // 확인한 정보를 snapshot(통채로 들고옴)
            const postId = snapshot.ZE.path.segments[3];
            let currentUserLike = false;
            if (snapshot.exists) {
                currentUserLike = true;
            }
            dispatch({type: USERS_LIKES_STATE_CHANGE, postId, currentUserLike})  // 새로운게 발견되면 usersLoaded가 +1 되고 새로 발견한 데이터를 기존 State에 추가
        })
    })
}
