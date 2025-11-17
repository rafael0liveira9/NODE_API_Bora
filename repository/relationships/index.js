const { jwtUncrypt } = require('../../utils/midleware/auth'),
    p = require('../../lib/prisma'),
    { verify, sign } = require("jsonwebtoken"),
    s3 = require('../s3/index'),
    { compareSync, hashSync } = require('bcryptjs'),
    error = {
        status: 500,
        message: "Erro Interno"
    },
    moment = require('moment');
const { textCheck } = require('../../utils');

const GetMyFriendRequest = async (req, res) => {

    const adminCheck = await jwtUncrypt(req.headers.authorization)

    if (!adminCheck?.user) {
        return res.status(403).json({
            message: "Usuário não autorizado."
        });
    }

    const alreadyUser = await p.user.findFirst({
        where: {
            id: adminCheck.user.id,
            situation: 1,
            deletedAt: null,
        },
        include: {
            client: true,
        },
    });

    if (!alreadyUser || !alreadyUser.client) {
        return res.status(403).json({ message: "Usuário não autorizado." });
    }

    const data = await p.friendship.findMany({
        where: {
            friend: alreadyUser?.client?.id,
            accept: 0,
        },
        include: {
            client_friendship_senderToclient: true,
        },
    })


    if (data) {
        return res.status(201).json(data);
    } else {
        return res.status(401).json({
            message: "Usuário não cadastrado."
        });
    }

}, PostFriendship = async (req, res) => {

    const adminCheck = await jwtUncrypt(req.headers.authorization)

    if (!adminCheck?.user) {
        return res.status(403).json({
            message: "Usuário não autorizado."
        });
    }

    const alreadyUser = await p.user.findFirst({
        where: {
            id: adminCheck.user.id,
            situation: 1,
            deletedAt: null,
        },
        include: {
            client: true,
        },
    });

    if (!alreadyUser || !alreadyUser.client) {
        return res.status(403).json({ message: "Usuário não autorizado." });
    }

    const data = await p.friendship.create({
        data: {
            sender: alreadyUser?.client?.id,
            friend: req.body.id,
        }
    })


    if (data) {
        return res.status(201).json(data);
    } else {
        return res.status(401).json({
            message: "Usuário não cadastrado."
        });
    }

}, AcceptFriendship = async (req, res) => {

    const adminCheck = await jwtUncrypt(req.headers.authorization)

    if (!adminCheck?.user) {
        return res.status(403).json({
            message: "Usuário não autorizado."
        });
    }

    const alreadyUser = await p.user.findFirst({
        where: {
            id: adminCheck.user.id,
            situation: 1,
            deletedAt: null,
        },
        include: {
            client: true,
        },
    });

    if (!alreadyUser || !alreadyUser.client) {
        return res.status(403).json({ message: "Usuário não autorizado." });
    }

    const request = await p.friendship.findFirst({
        where: {
            sender: req.body.sender,
            friend: alreadyUser.client.id.id,
            accept: 0
        }
    })

    if (!request) {
        return res.status(403).json({ message: "Pedido não encontrado." });
    }

    const data = await p.friendship.update({
        where: {
            id: request?.id
        },
        data: {
            accept: req.body.accept === true ? 1 : 2,
            updatedAt: new Date()
        }
    })


    if (data) {
        return res.status(201).json(data);
    } else {
        return res.status(401).json({
            message: "Usuário não cadastrado."
        });
    }

}, PostRelationship = async (req, res) => {

    const adminCheck = await jwtUncrypt(req.headers.authorization)

    if (!adminCheck?.user) {
        return res.status(403).json({
            message: "Usuário não autorizado."
        });
    }

    const alreadyUser = await p.user.findFirst({
        where: {
            id: adminCheck.user.id,
            situation: 1,
            deletedAt: null,
        },
        include: {
            client: true,
        },
    });

    if (!alreadyUser || !alreadyUser.client) {
        return res.status(403).json({ message: "Usuário não autorizado." });
    }

    const data = await p.relationship.create({
        data: {
            responsible: alreadyUser?.client?.id,
            client: req.body.id,
        }
    })


    if (data) {
        return res.status(201).json(data);
    } else {
        return res.status(401).json({
            message: "Usuário não cadastrado."
        });
    }

}, AcceptRelationship = async (req, res) => {

    const adminCheck = await jwtUncrypt(req.headers.authorization)

    if (!adminCheck?.user) {
        return res.status(403).json({
            message: "Usuário não autorizado."
        });
    }

    const alreadyUser = await p.user.findFirst({
        where: {
            id: adminCheck.user.id,
            situation: 1,
            deletedAt: null,
        },
        include: {
            client: true,
        },
    });

    if (!alreadyUser || !alreadyUser.client) {
        return res.status(403).json({ message: "Usuário não autorizado." });
    }

    const request = await p.relationship.findFirst({
        where: {
            responsible: req.body.id,
            client: alreadyUser.client.id,
            accept: 0
        }
    })


    if (!request) {
        return res.status(403).json({ message: "Pedido não encontrado." });
    }

    const data = await p.relationship.update({
        where: {
            id: request?.id
        },
        data: {
            accept: req.body.accept === true ? 1 : 2,
            updatedAt: new Date()
        }
    })


    if (data) {
        return res.status(201).json(data);
    } else {
        return res.status(401).json({
            message: "Usuário não cadastrado."
        });
    }

}, GetMyFriends = async (req, res) => {

    const adminCheck = await jwtUncrypt(req.headers.authorization)

    if (!adminCheck?.user) {
        return res.status(403).json({
            message: "Usuário não autorizado."
        });
    }

    const alreadyUser = await p.user.findFirst({
        where: {
            id: adminCheck.user.id,
            situation: 1,
            deletedAt: null,
        },
        include: {
            client: true,
        },
    });

    if (!alreadyUser || !alreadyUser.client) {
        return res.status(403).json({ message: "Usuário não autorizado." });
    }

    console.log('a', alreadyUser.client.id)

    const friends = await p.friendship.findMany({
        where: {
            accept: 1,
            OR: [
                { friend: alreadyUser.client.id },
                { sender: alreadyUser.client.id }
            ]
        }
    });
    const requests = await p.friendship.findMany({
        where: {
            accept: 0,
            sender: alreadyUser.client.id
        }
    });
    const receives = await p.friendship.findMany({
        where: {
            accept: 0,
            friend: alreadyUser.client.id
        }
    });
    console.log('b', friends)

    if (!friends) {
        return res.status(403).json({ message: "Pedido não encontrado." });
    }


    if (friends || requests || receives) {
        return res.status(201).json({ friends: friends, requests: requests, receives: receives });
    } else {
        return res.status(401).json({
            message: "Usuário não cadastrado."
        });
    }

};

module.exports = { GetMyFriendRequest, AcceptFriendship, PostFriendship, AcceptRelationship, PostRelationship, GetMyFriends };